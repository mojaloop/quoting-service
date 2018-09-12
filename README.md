# quoting-service-api-adapter

Swagger api [location](./config/swagger.json)

# Testing

```
docker build -t quoting-service-api-adapter:latest ./
docker run --rm --link db:mysql quoting-service-api-adapter:latest
```
