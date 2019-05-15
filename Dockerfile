FROM node:10.15.3-alpine

WORKDIR /opt/quoting-service
COPY src /opt/quoting-service/src
COPY config /opt/quoting-service/config
COPY package.json /opt/quoting-service/

RUN npm install --production

EXPOSE 3000

CMD npm run start
