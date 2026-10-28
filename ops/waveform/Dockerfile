FROM rust:bookworm@sha256:48b7f435b8fc6378ce43b44f15e3a47fd8919b2825f835c39bd4bd3da50af5b8 AS tools
RUN rustup component add rustfmt clippy

FROM tools AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
RUN cargo fmt --check && cargo test --locked && cargo clippy --locked --all-targets -- -D warnings \
    && cargo build --locked --release

FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3 AS packages
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL https://github.com/bbc/audiowaveform/releases/download/1.10.2/audiowaveform_1.10.2-1-12_arm64.deb -o /tmp/audiowaveform.deb \
    && echo '60459d5070aeafb4e73ba3873b3dd6c964b3bf4646d1caba67ab76554fb21c0e  /tmp/audiowaveform.deb' | sha256sum -c -

FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3 AS worker
COPY --from=packages /tmp/audiowaveform.deb /tmp/audiowaveform.deb
RUN test "$(dpkg --print-architecture)" = arm64 \
    && apt-get update && apt-get install -y --no-install-recommends \
       ffmpeg=7:5.1.9-0+deb12u1 /tmp/audiowaveform.deb \
    && rm -rf /var/lib/apt/lists/* /tmp/audiowaveform.deb
ENV HOME=/tmp TMPDIR=/tmp
COPY --from=build /src/target/release/oioi-waveform /usr/local/bin/oioi-waveform
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/oioi-waveform"]

FROM worker AS toolchain
