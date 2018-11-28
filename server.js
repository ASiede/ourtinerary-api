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
const { Trip, User, ItineraryItem, Vote } = require('./models');

const jsonParser = bodyParser.json();
const app = express();


const {CLIENT_ORIGIN} = require('./config');
// const PORT = process.env.PORT || 3000;
app.use(
    cors({
        origin: CLIENT_ORIGIN
    })
);

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

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
		//not populating but doing something
		// .populate({path:'itineraryItems.votes', select: 'Vote'})
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
app.get('/trips/:id', (req, res) => {
	Trip
		.findById(req.params.id)
		.populate('trips')
		.populate('collaborators')
		// NOT WORKNG CORRECTLY
		.populate({path:'itineraryItems.votes', select: 'Vote'})
    // .then(trip => res.json(trip.serialize()))
		.then(trip => res.end())
		.catch(err => {
			console.error(err);
			res.status(500).json({message: "Internal server error"});
		});
});
//POST endpoint for new trips
app.post('/trips', jsonParser, (req, res) => {
	// Check for required fields
	const requiredFields = ['name', 'dates', 'location', 'tripLeader', 'collaborators'];
 	for (let i = 0; i < requiredFields.length; i++) {
    	const field = requiredFields[i];
    	if (!(field in req.body)) {
      		const message = `Missing \`${field}\` in request body`;
      		console.error(message);
      		return res.status(400).send(message);
    	}
  	}
	User
    // GET user information to attach to trip document
    .findOne({_id: `${req.body.tripLeader}`})
    .then( user => { 
    	if (user) {
    		const collaborators = req.body.collaborators
    		collaborators.push(req.body.tripLeader)
    		User
    		.find({
    			_id: {$in: collaborators}
    		})
    		.then(collaborators => {
	        	Trip
	        	.create({
	          		name: req.body.name,
	          		dates: req.body.dates,
	          		location: req.body.location,
	          		tripLeader: user,
	          		collaborators: collaborators,
	          		itineraryItems: []
	          	})
	        	.then(trip => {
	        	    collaborators.forEach(collaborator => {
                      console.log(collaborator)
                      console.log(trip)
                      User
	        			      .findByIdAndUpdate(collaborator._id, { $push: {trips: trip}})
                      .then(updatedUser => console.log(updatedUser))
                      .catch(err => {
                          console.error(err);
                          res.status(500).json({ message: 'Internal server error' });
                      })
	        	    })
	        	res.status(201).json(trip.serialize())
	        	})
	        	.catch(err => {
	        		console.error(err);
	        		res.status(500).json({ message: 'Internal server error' });
	        	})
	        })
	        .catch(err => {
	        		console.error(err);
	        		res.status(500).json({ message: 'Internal server error' });
	        })	
      	} else {
        	const message = `User not found`;
        	console.error(message);
        	return res.status(500).send(message);
        }    
    })
    .catch(err => {
    	console.error(err);
    	res.status(500).json({ error: 'Internal server error' });
    })
});
//PUT endpoint for updating existing trips (by id)
app.put('/trips/:id', jsonParser, (req, res) => {
  // ensure that the id in the request path and the one in request body match
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
    const message = (
      `Request path id (${req.params.id}) and request body id ` +
      `(${req.body.id}) must match`);
    console.error(message);
    return res.status(400).json({ message: message });
  }
  const toUpdate = {};
  const updateableFields = ['name', 'dates', 'location', 'collaborators'];
  updateableFields.forEach(field => {
    if (field in req.body) {
      toUpdate[field] = req.body[field];
    }
  });
  Trip.findOneAndUpdate({_id:req.params.id}, { $set: toUpdate })
    .then(trip => res.status(201).end())
    .catch(err => res.status(500).json({ message: 'Internal server error' }));
});

//DELETE endpoint for deleting existing trips (by id)
app.delete('/trips/:id', (req, res) => {
  Trip
    .findOneAndDelete({_id: req.params.id})
    .then(trip => res.status(204).end())
    .catch(err => res.status(500).json({ message: 'Internal server error' }));
});




//GET endpoint for itinerary items
//GET endpoint for itinerary items by id
app.get('/itineraryItems/:id', (req, res) => {
  ItineraryItem
    .findById(req.params.id)
    .then(itineraryItem => res.json(itineraryItem.serialize()))
    .catch(err => {
      console.error(err);
      res.status(500).json({message: "Internal server error"});
    });
});

// .then(itineraryItem => { 

//POST endpoint for new itinerary items
app.post('/itineraryItems', jsonParser, (req, res) => {
    // Check for required fields
    const requiredFields = ['name', 'tripId', 'type'];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!(field in req.body)) {
      	    const message = `Missing \`${field}\` in request body`;
      		  console.error(message);
      		return res.status(400).send(message);
    	   }
  	}
    Trip
    .findOne({_id: `${req.body.tripId}`})
    .then( trip => { 
        if (trip) {
            
            ItineraryItem
            .create({
              type: req.body.type,
              name: req.body.name,
              confirmed: false,
              price: req.body.price,
              pool: req.body.pool,
              website: req.body.website,
              other: req.body.other,
              votes: []
            })
            .then(itineraryItem => {
                const collaborators = trip.collaborators
                let votes = collaborators.map(collaborator => {
                    Vote
                    .create({
                        itineraryItem: itineraryItem._id,
                        tripId: req.body.tripId,
                        user: collaborator,
                        status: ""
                    })
                    .then(vote => {
                        
                        ItineraryItem
                        .findByIdAndUpdate(itineraryItem.id, {$push: {votes: vote}}) 
                        .then(updatedItem => {
                            res.status(200).end()
                            console.log(updatedItem)
                            // itineraryItem = updatedItem
                            // console.log(itineraryItem)
                            // console.log('test')
                            // console.log(updatedItem)
                        }) 
                       .catch(err => {
                        console.error(err);
                        res.status(500).json({ error: 'Internal server error' });
                      })  
                    })
                    .catch(err => {
                        console.error(err);
                        res.status(500).json({ error: 'Internal server error' });
                    })    
                })
                ItineraryItem
                .findById(itineraryItem.id)
                .then(itineraryItem => {
                  console.log(itineraryItem)
                  res.status(201).json(itineraryItem.serialize())
                })
                
            })

            .catch(err => {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            })
      	} else {
        	const message = `Trip not found`;
        	console.error(message);
        	return res.status(500).send(message);
         
        }
    })  
    .catch(err => {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    })
})

//PUT endpoint for updating existing itinerary items (by id)
app.put('/itineraryItems/:id', (req, res) => {
    const requiredFields = ['itineraryItemId', 'tripId'];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!(field in req.body)) {
            const message = `Missing \`${field}\` in request body`;
            console.error(message);
            return res.status(400).send(message);
        }
    }
    const toUpdate = {};
    const updateableFields = ['name'];
    updateableFields.forEach(field => {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    ItineraryItem
        .findOneAndUpdate({_id: req.body.itineraryItemId}, toUpdate)
        .then(itineraryItem => {
            res.status(201).json(itineraryItem.serialize())
        })
        //NEED TO UPDATE TRIP

});

//DELETE endpoint for deleting existing itinerary items (by id)
app.delete('/itineraryItems/:id', (req, res) => {
    const requiredFields = ['tripId', 'itineraryItemId'];
    		for (let i = 0; i < requiredFields.length; i++) {
            const field = requiredFields[i];
      		  if (!(field in req.body)) {
        		    const message = `Missing \`${field}\` in request body`;
        		    console.error(message);
        		    return res.status(400).send(message);
            }
        }
    Trip
    .findById(req.body.tripId)
    .then(trip => {
        console.log(trip)
        ItineraryItem
        .findById(req.body.itineraryItemId)
        .then(itineraryItem => {
            trip.itineraryItems.id(req.body.itineraryItemId).remove()
            trip.save();
            res.status(204).end()
        })
        .catch(err => res.status(500).json({ message: 'Internal server error' }));
    })
    .catch(err => res.status(500).json({ message: 'Internal server error' }));    
    
});



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