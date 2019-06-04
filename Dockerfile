FROM node:10.15.3-alpine
WORKDIR /opt/quoting-service

COPY package.json package-lock.json* /opt/quoting-service/

RUN npm install --production

COPY config /opt/quoting-service/config
COPY src /opt/quoting-service/src

EXPOSE 3002
CMD ["npm", "run", "start"]
