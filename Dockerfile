# A docker container that can be used to run imports (from EASTIN, the SAI) and maintenance scripts.
#
# Expects to be able to reach a container with the alias "couchdb", such as we use from the ul-website project.

FROM node:8.12.0-alpine

# Store a copy of our code in a TLD in the container.
WORKDIR /ul-imports
COPY . /ul-imports

# Make sure not to install any dev dependencies.
ENV NODE_ENV production

# Install our dependencies
RUN apk update && \
    apk add --no-cache --virtual build-dependencies python make git g++ && \
    rm -rf node_modules/* && \
    npm install && \
    npm cache clean --force && \
    apk del build-dependencies

ENTRYPOINT ["npm", "run"]
CMD ["full-sync"]
