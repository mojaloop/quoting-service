FROM node:10.15.3-alpine
WORKDIR /opt/quoting-service

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/quoting-service/

RUN npm install --production

RUN apk del build-dependencies

COPY config /opt/quoting-service/config
COPY src /opt/quoting-service/src

EXPOSE 3002
CMD ["npm", "run", "start"]
