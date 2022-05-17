FROM debian:11.3-slim

ARG PI_GEN_VERSION
ARG PI_GEN_DIR=/tmp/pi-gen

RUN apt-get install -y git && mkdir -p $PI_GEN_DIR
RUN git clone --depth 1 --branch $PI_GEN_VERSION https://github.com/RPI-Distro/pi-gen.git $PI_GEN_DIR
RUN apt-get install $(grep -Po '[^:]+$' ${PI_GEN_DIR}/depends)

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh", "$PI_GEN_DIR"]
