FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3 AS packages
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL https://github.com/bbc/audiowaveform/releases/download/1.10.2/audiowaveform_1.10.2-1-12_arm64.deb -o /tmp/audiowaveform.deb \
    && echo '60459d5070aeafb4e73ba3873b3dd6c964b3bf4646d1caba67ab76554fb21c0e  /tmp/audiowaveform.deb' | sha256sum -c -

FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3 AS worker
COPY --from=packages /tmp/audiowaveform.deb /tmp/audiowaveform.deb
RUN test "$(dpkg --print-architecture)" = arm64 \
    && apt-get update && apt-get install -y --no-install-recommends \
       python3=3.11.2-1+b1 ffmpeg=7:5.1.9-0+deb12u1 /tmp/audiowaveform.deb \
    && rm -rf /var/lib/apt/lists/* /tmp/audiowaveform.deb
ENV HOME=/tmp TMPDIR=/tmp PYTHONDONTWRITEBYTECODE=1
COPY analyze.py /opt/analyze.py
USER 65532:65532
ENTRYPOINT ["python3", "/opt/analyze.py"]

FROM worker AS toolchain
