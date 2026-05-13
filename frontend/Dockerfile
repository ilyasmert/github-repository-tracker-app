# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.jso[n] ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]