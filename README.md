# Capabilities Catalog
A data-driven view for Blackbaud's Shared Capabilities Catalog

## Steps to run locally

### Install the dependencies
```
$ npm install
```

### Boot-up the database
- Install [MongoDB](https://docs.mongodb.org/manual/installation/) locally.
- Then, run MongoDB:
```
$ mongod
```

### Configure the app and create logins
- Copy **config.sample-env** and name it **config.env**.
- Make sure the property `DATABASE_URI` points to the port of your MongoDB install (port `27017` is default).
- For `SITE_ADMINISTRATORS`, add your email address (can be fake)
- For `SITE_ADMINISTRATORS_PASSPHRASE`, add any combination of letters/numbers.
- Everything else can be left blank for now.
- Open a new Terminal/Command-Prompt window and type:
```
$ npm run setup
```

### Build the front-end (optional)
- Open a new Terminal/Command-Prompt window and type:
```
$ bower install
$ grunt build
```

### Start the server
```
$ npm start
```

- Go to [http://localhost:5000/](http://localhost:3000/).
