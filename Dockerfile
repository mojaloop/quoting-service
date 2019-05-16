FROM node:10.15-alpine

WORKDIR /opt/quoting-service
COPY src /opt/quoting-service/src
COPY config /opt/quoting-service/config
COPY package.json /opt/quoting-service/

RUN npm install --production

EXPOSE 3002

CMD npm run start