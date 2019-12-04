FROM node:10.15.3-alpine as builder

WORKDIR /opt/quoting-service

COPY package.json package-lock.json* /opt/quoting-service/

RUN npm install

COPY config /opt/quoting-service/config
COPY src /opt/quoting-service/src

FROM node:10.15.3-alpine

WORKDIR /opt/quoting-service

COPY --from=builder /opt/quoting-service .
RUN npm prune --production

EXPOSE 3002
CMD ["npm", "run", "start"]
