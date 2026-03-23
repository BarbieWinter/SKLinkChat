FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ARG VITE_ENDPOINT=http://localhost:8000
ARG VITE_WS_ENDPOINT=ws://localhost:8000/ws

ENV VITE_ENDPOINT=${VITE_ENDPOINT}
ENV VITE_WS_ENDPOINT=${VITE_WS_ENDPOINT}

RUN npm run build

EXPOSE 4173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
