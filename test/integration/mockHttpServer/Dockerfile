FROM node:18-alpine

WORKDIR /usr/src/app

COPY ./*.js ./

RUN adduser -D test-user
USER test-user

EXPOSE 7777

CMD [ "node", "server.js" ]
