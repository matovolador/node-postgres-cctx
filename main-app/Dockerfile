FROM node:17

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production

COPY . .

RUN chmod +x ./startup.sh

CMD ["./startup.sh"]