FROM buildkite/puppeteer:latest
RUN mkdir /app
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
CMD ["npm", "run", "test"]