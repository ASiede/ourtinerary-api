'use strict';

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');
const cors = require('cors');

require('dotenv').config();

const bodyParser = require('body-parser');

const { router: usersRouter } = require('./users');
const { router: authRouter, localStrategy, jwtStrategy } = require('./auth');

mongoose.Promise = global.Promise;

const { PORT, DATABASE_URL } = require('./config');
const { Trip, User } = require('./models');

const jsonParser = bodyParser.json();
const app = express();


const {CLIENT_ORIGIN} = require('./config');
// const PORT = process.env.PORT || 3000;
app.use(
    cors({
        origin: CLIENT_ORIGIN
    })
);
app.use(express.static('public'));
app.use(express.json());
app.use(morgan('common'));

passport.use(localStrategy);
passport.use(jwtStrategy);

app.use('/users', usersRouter);
app.use('/auth/', authRouter);

//include this as middleware for anything for which you must be an authorized user
const jwtAuth = passport.authenticate('jwt', { session: false });

//GET endpoint for trips

app.get('/trips', (req, res) => {
	Trip
		.find()
		.populate('tripLeader')
		.populate('collaborators')
		.then(trips => {
			res.json({
				trips: trips.map(trip => trip.serialize())
			});
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({message: "Internal server error"});
		});
});
//GET endpoint for trips by id
//POST endpoint for new trips
//PUT endpoint for updating existing trips (by id)
//DELETE endpoint for deleting existing trips (by id)

//GET endpoint for itinerary items
//GET endpoint for itinerary items by id
//POST endpoint for new itinerary items
//PUT endpoint for updating existing itinerary items (by id)
//DELETE endpoint for deleting existing itinerary items (by id)


//Server setup

let server;

function runServer(databaseUrl, port = PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(
      databaseUrl, { useNewUrlParser: true },
      err => {
        if (err) {
          return reject(err);
        }
        server = app
          .listen(port, () => {
            console.log(`Your app is listening on port ${port}`);
            resolve();
          })
          .on("error", err => {
            mongoose.disconnect();
            reject(err);
          });
      }
    );
  });
}

function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log("Closing server");
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

if (require.main === module) {
  runServer(DATABASE_URL).catch(err => console.error(err));
};

module.exports = { app, runServer, closeServer}