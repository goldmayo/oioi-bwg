use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Read, Write},
    os::fd::{AsFd, AsRawFd},
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

const RATE: u64 = 24_000;
const BUCKET: u64 = 480;
const MAX_PCM: u64 = RATE * 2 * 3600;
const MAX_JSON: usize = 4 * 1024 * 1024;
static INTERRUPTED: AtomicBool = AtomicBool::new(false);

extern "C" fn interrupt(_: libc::c_int) {
    INTERRUPTED.store(true, Ordering::Relaxed);
}

fn failed<T>() -> io::Result<T> {
    Err(io::Error::other("WAVEFORM_ANALYSIS_FAILED"))
}

struct Guard(Instant);
impl Guard {
    fn check(&self) -> io::Result<()> {
        if Instant::now() >= self.0 || INTERRUPTED.load(Ordering::Relaxed) {
            return failed();
        }
        Ok(())
    }
    fn ready(&self, fd: libc::c_int, events: libc::c_short) -> io::Result<()> {
        loop {
            self.check()?;
            let mut descriptor = libc::pollfd {
                fd,
                events,
                revents: 0,
            };
            let timeout = self
                .0
                .saturating_duration_since(Instant::now())
                .as_millis()
                .clamp(1, 100) as i32;
            // SAFETY: descriptor는 호출 동안 유효하며 poll은 음원 내용을 복제·저장하지 않는다.
            let status = unsafe { libc::poll(&mut descriptor, 1, timeout) };
            if status > 0 {
                return Ok(());
            }
            if status < 0 && io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
                return Err(io::Error::last_os_error());
            }
        }
    }
    fn write(&self, output: &mut (impl Write + AsRawFd), mut bytes: &[u8]) -> io::Result<()> {
        while !bytes.is_empty() {
            self.ready(output.as_raw_fd(), libc::POLLOUT)?;
            match output.write(bytes) {
                Ok(0) => return failed(),
                Ok(n) => bytes = &bytes[n..],
                Err(e)
                    if matches!(
                        e.kind(),
                        io::ErrorKind::Interrupted | io::ErrorKind::WouldBlock
                    ) => {}
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }
    fn fill(&self, input: &mut (impl Read + AsRawFd), bytes: &mut [u8]) -> io::Result<usize> {
        let mut filled = 0;
        while filled < bytes.len() {
            self.ready(input.as_raw_fd(), libc::POLLIN)?;
            match input.read(&mut bytes[filled..]) {
                Ok(0) => break,
                Ok(n) => filled += n,
                Err(e)
                    if matches!(
                        e.kind(),
                        io::ErrorKind::Interrupted | io::ErrorKind::WouldBlock
                    ) => {}
                Err(e) => return Err(e),
            }
        }
        Ok(filled)
    }
    fn wait(&self, child: &mut Child) -> io::Result<()> {
        loop {
            self.check()?;
            if let Some(status) = child.try_wait()? {
                return if status.success() { Ok(()) } else { failed() };
            }
            std::thread::sleep(Duration::from_millis(5));
        }
    }
}

fn nonblocking(file: &impl AsRawFd) -> io::Result<()> {
    // SAFETY: 소유한 열린 fd에 상태 flag만 설정한다. read/write 대기도 Guard 기한을 따른다.
    unsafe {
        let fd = file.as_raw_fd();
        let flags = libc::fcntl(fd, libc::F_GETFL);
        if flags < 0 || libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK) < 0 {
            return Err(io::Error::last_os_error());
        }
    }
    Ok(())
}

fn prepare() -> io::Result<()> {
    // SAFETY: 유효한 rlimit/sigaction 구조체를 전달한다. handler는 lock-free flag만 설정한다.
    unsafe {
        for (kind, limit) in [
            (libc::RLIMIT_CORE, 0),
            (libc::RLIMIT_FSIZE, MAX_JSON as u64),
        ] {
            if libc::setrlimit(
                kind,
                &libc::rlimit {
                    rlim_cur: limit,
                    rlim_max: limit,
                },
            ) != 0
            {
                return Err(io::Error::last_os_error());
            }
        }
        let mut action: libc::sigaction = std::mem::zeroed();
        action.sa_sigaction = interrupt as *const () as usize;
        libc::sigemptyset(&mut action.sa_mask);
        for sig in [libc::SIGTERM, libc::SIGINT] {
            if libc::sigaction(sig, &action, std::ptr::null_mut()) != 0 {
                return Err(io::Error::last_os_error());
            }
        }
    }
    Ok(())
}

struct Temporary(String);
impl Drop for Temporary {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
struct Children(Vec<Child>);
impl Drop for Children {
    fn drop(&mut self) {
        for child in &mut self.0 {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[derive(Deserialize, Serialize)]
struct Peaks {
    version: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    channels: Option<u8>,
    sample_rate: u64,
    samples_per_pixel: u64,
    bits: u8,
    length: u64,
    data: Vec<i16>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultData {
    duration_ms: u64,
    bucket_size_ms: u8,
    peaks: Peaks,
}

fn project(count: u64, encoded: &[u8]) -> io::Result<Vec<u8>> {
    let duration_ms = (count as f64 * 1000.0 / (RATE * 2) as f64).round_ties_even() as u64;
    if count > MAX_PCM || !count.is_multiple_of(2) || duration_ms == 0 || encoded.len() > MAX_JSON {
        return failed();
    }
    let peaks: Peaks = serde_json::from_slice(encoded)?;
    let length = count.div_ceil(BUCKET * 2);
    if ![1, 2].contains(&peaks.version)
        || peaks.channels.is_some_and(|n| n != 1)
        || (peaks.version == 2 && peaks.channels.is_none())
        || peaks.sample_rate != RATE
        || peaks.samples_per_pixel != BUCKET
        || peaks.bits != 8
        || peaks.length != length
        || peaks.data.len() as u64 != length * 2
        || peaks
            .data
            .as_chunks::<2>()
            .0
            .iter()
            .any(|p| p[0] < -128 || p[0] > p[1] || p[1] > 127)
    {
        return failed();
    }
    let result = serde_json::to_vec(&ResultData {
        duration_ms,
        bucket_size_ms: 20,
        peaks,
    })?;
    if result.len() > MAX_JSON {
        return failed();
    }
    Ok(result)
}

fn analyze(guard: &Guard) -> io::Result<Vec<u8>> {
    let directory = format!("/tmp/waveform-{}", std::process::id());
    fs::create_dir(&directory)?;
    let temporary = Temporary(directory);
    let output = format!("{}/peaks.json", temporary.0);
    let mut children = Children(Vec::new());
    children.0.push(
        Command::new("ffmpeg")
            .args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-xerror",
                "-nostdin",
                "-threads",
                "1",
                "-protocol_whitelist",
                "pipe",
                "-f",
                "wav",
                "-i",
                "pipe:0",
                "-map",
                "0:a:0",
                "-vn",
                "-ac",
                "1",
                "-ar",
                "24000",
                "-threads",
                "1",
                "-f",
                "s16le",
                "pipe:1",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?,
    );
    children.0.push(
        Command::new("audiowaveform")
            .args([
                "--input-format",
                "raw",
                "--raw-format",
                "s16le",
                "--raw-samplerate",
                "24000",
                "--raw-channels",
                "1",
                "--output-format",
                "json",
                "-o",
                &output,
                "-z",
                "480",
                "-b",
                "8",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?,
    );
    let mut reader = children.0[0]
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("pipe"))?;
    let mut writer = children.0[1]
        .stdin
        .take()
        .ok_or_else(|| io::Error::other("pipe"))?;
    nonblocking(&reader)?;
    nonblocking(&writer)?;
    let mut buffer = [0u8; 65536];
    let mut count = 0;
    loop {
        let size = guard.fill(&mut reader, &mut buffer)?;
        if size == 0 {
            break;
        }
        count += size as u64;
        if count > MAX_PCM {
            return failed();
        }
        guard.write(&mut writer, &buffer[..size])?;
    }
    drop(writer);
    for child in &mut children.0 {
        guard.wait(child)?;
    }
    let mut encoded = Vec::new();
    fs::File::open(output)?
        .take((MAX_JSON + 1) as u64)
        .read_to_end(&mut encoded)?;
    guard.check()?;
    project(count, &encoded)
}

fn run() -> io::Result<()> {
    if std::env::args_os().len() != 1 {
        return failed();
    }
    let guard = Guard(Instant::now() + Duration::from_secs(120));
    prepare()?;
    let result = analyze(&guard)?;
    let mut output = fs::File::from(io::stdout().as_fd().try_clone_to_owned()?);
    nonblocking(&output)?;
    guard.write(&mut output, &result)?;
    guard.write(&mut output, b"\n")
}

fn main() {
    if run().is_err() {
        eprintln!("WAVEFORM_ANALYSIS_FAILED");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::net::UnixStream;
    #[test]
    fn duration_uses_pcm_count_including_partial_bucket() {
        let peaks = serde_json::json!({"version":2,"channels":1,"sample_rate":24000,"samples_per_pixel":480,"bits":8,"length":2,"data":[-128,127,0,0]});
        let bytes = serde_json::to_vec(&peaks).unwrap();
        let result: serde_json::Value =
            serde_json::from_slice(&project(962, &bytes).unwrap()).unwrap();
        assert_eq!(result["durationMs"], 20);
        assert!(project(0, &bytes).is_err());
        assert!(project(961, &bytes).is_err());
        let mut invalid = peaks;
        invalid["data"][1] = serde_json::json!(-129);
        assert!(project(962, &serde_json::to_vec(&invalid).unwrap()).is_err());
    }
    #[test]
    fn deadline_interrupts_blocked_read_and_write() {
        let (mut reader, mut writer) = UnixStream::pair().unwrap();
        reader.set_nonblocking(true).unwrap();
        writer.set_nonblocking(true).unwrap();
        assert!(Guard(Instant::now() + Duration::from_millis(20))
            .fill(&mut reader, &mut [0; 1])
            .is_err());
        assert!(Guard(Instant::now() + Duration::from_millis(20))
            .write(&mut writer, &vec![0; 1024 * 1024])
            .is_err());
    }
    #[test]
    fn deadline_interrupts_child_wait_and_drop_reaps() {
        let mut children = Children(vec![Command::new("sleep").arg("5").spawn().unwrap()]);
        assert!(Guard(Instant::now() + Duration::from_millis(20))
            .wait(&mut children.0[0])
            .is_err());
    }
}
