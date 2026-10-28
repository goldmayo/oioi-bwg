FROM rust:bookworm@sha256:48b7f435b8fc6378ce43b44f15e3a47fd8919b2825f835c39bd4bd3da50af5b8 AS tools
RUN rustup component add rustfmt clippy

FROM tools AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
RUN cargo fmt --check && cargo test --locked && cargo clippy --locked --all-targets -- -D warnings \
    && cargo build --locked --release

FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3 AS packages
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && curl -fsSL https://github.com/bbc/audiowaveform/releases/download/1.10.2/audiowaveform_1.10.2-1-12_arm64.deb -o /tmp/audiowaveform.deb \
    && echo '60459d5070aeafb4e73ba3873b3dd6c964b3bf4646d1caba67ab76554fb21c0e  /tmp/audiowaveform.deb' | sha256sum -c -
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp_linux_aarch64.zip -o /tmp/yt-dlp.zip \
    && echo '74708e707e8fa8177c8347e58152337edf320149cd7b225defd453f7cde47822  /tmp/yt-dlp.zip' | sha256sum -c - \
    && unzip -q /tmp/yt-dlp.zip -d /opt/yt-dlp \
    && chmod 755 /opt/yt-dlp/yt-dlp_linux_aarch64 \
    && curl -fsSL https://github.com/denoland/deno/releases/download/v2.9.8/deno-aarch64-unknown-linux-gnu.zip -o /tmp/deno.zip \
    && echo 'd49596c20b9788cf8f5d8ddf644103d4bde56ed239753f0bdb92ba9361d51905  /tmp/deno.zip' | sha256sum -c - \
    && unzip -q /tmp/deno.zip -d /opt/deno

FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3 AS worker
COPY --from=packages /tmp/audiowaveform.deb /tmp/audiowaveform.deb
RUN test "$(dpkg --print-architecture)" = arm64 \
    && apt-get update && apt-get install -y --no-install-recommends \
       ffmpeg=7:5.1.9-0+deb12u1 /tmp/audiowaveform.deb \
    && rm -rf /var/lib/apt/lists/* /tmp/audiowaveform.deb
ENV HOME=/tmp TMPDIR=/tmp
COPY --from=packages /opt/yt-dlp /opt/yt-dlp
COPY --from=packages /opt/deno/deno /usr/local/bin/deno
COPY --from=build /src/target/release/oioi-waveform /usr/local/bin/oioi-waveform
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/oioi-waveform"]

FROM worker AS toolchain
