FROM semtech/mu-javascript-template:1.8.0
LABEL maintainer="info@redpencil.io"
ENV SUDO_QUERY_RETRY="false"
ENV SUDO_QUERY_RETRY_FOR_HTTP_STATUS_CODES="404,500,503"
ENV WRITE_DEBUG_TTLS="true"
