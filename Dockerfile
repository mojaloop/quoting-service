FROM node:8.11.3-alpine

COPY ./src /src/

WORKDIR /src

RUN npm install

COPY ./src /src/

CMD ["node", "/src/server.js"]

