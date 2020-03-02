FROM node:12.16.0-alpine as builder

WORKDIR /opt/quoting-service

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/quoting-service/

RUN npm install

RUN apk del build-dependencies

COPY src /opt/quoting-service/src

FROM node:12.16.0-alpine

WORKDIR /opt/quoting-service

COPY --from=builder /opt/quoting-service .
RUN npm prune --production

EXPOSE 3002
CMD ["npm", "run", "start"]
