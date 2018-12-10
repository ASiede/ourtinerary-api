'use strict';

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');
const cors = require('cors');
const path = require('path')
const nodeMailer = require('nodemailer');

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

app.get('/', (req, res) => {
    res.json({ok: true});
});

//GET endpoint for trips
app.get('/trips', (req, res) => {
  	let searchParametersArray = []
  	if (req.body.ids) {
    		req.body.ids.map(id => {
    		    searchParametersArray.push(id)
    		})
  	}

    if (req.body.ids) {
    		Trip
      			.find({_id: {$in: searchParametersArray}})
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
    } else {
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
    }	
});

//GET endpoint for trips by id
app.get('/trips/:id', (req, res) => {
  	Trip
    		.findById(req.params.id)
    		.populate('tripLeader')
    		.populate('collaborators')
    		.populate('itineraryItems')
    		.populate({
    		    path:'itineraryItems.votes', select: 'Vote'
    		})
    		.then(trip => res.status(200).json(trip.serialize()))
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
    Trip.findOneAndUpdate({_id:req.params.id}, { $set: toUpdate }, {new: true})
      	.populate('collaborators')
      	.populate('tripLeader')
      	.populate({
          	path: 'itineraryItems',
          	model: 'ItineraryItem',
          	populate: {
            		path: 'votes',
            		model: 'Vote'
          	}
        })
        .then(trip => res.status(201).json(trip.serialize()))
        .catch(err => res.status(500).json({ message: 'Internal server error' }));
});

//DELETE endpoint for deleting existing trips (by id)
app.delete('/trips/:id', (req, res) => {
    Trip
        .findOneAndDelete({_id: req.params.id})
        .then(trip => res.status(204).end())
        .catch(err => res.status(500).json({ message: 'Internal server error' }));
});

//NEED TO ADD IF NOT FOUND MAYBE
app.get('/itineraryItems/:id', (req, res) => {
    ItineraryItem
        .findById(req.params.id)
        .populate({
          	path: 'votes',
          	model: 'Vote',
          	populate: {
            		path: 'user',
            		model: 'User'
          	}
        })
        .then(itineraryItem => res.json(itineraryItem.serialize()))
        .catch(err => {
            console.error(err);
            res.status(500).json({message: "Internal server error"});
        });
});


//POST endpoint for new itinerary items
app.post('/itineraryItems', jsonParser, (req, res) => {
    // Check for required fields
    const requiredFields = ['tripId', 'type'];
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
                confirmed: false,
                flightNumber: req.body.flightNumber,
                layovers: req.body.layovers,
                length: req.body.length,
                departureTimeArrivalTime: req.body.departureTimeArrivalTime,
                name: req.body.name,
                price: req.body.price,
                location: req.body.location,
                pool: req.body.pool,
                foodType: req.body.foodType,
                website: req.body.website,
                other: req.body.other,
                votes: []
            })
            .then(itineraryItem => {
                Trip
                .findById(trip.id)
                .then(updatedTrip => {
                		const collaborators = trip.collaborators
                    collaborators.forEach((collaborator, index) => {
                        Vote
                        .create({
                            itineraryItem: itineraryItem._id,
                            tripId: req.body.tripId,
                            user: collaborator,
                            status: ""
                        })
                        .then(vote => {
                            ItineraryItem
                                .findByIdAndUpdate(itineraryItem.id,{$push: {votes: vote}}, {new: true})
                                .populate('votes')
                                .then(updatedItem => {
                                    if (index === (collaborators.length -1)) {
                				        		    ItineraryItem
                				        		    .find({_id: itineraryItem._id})
                				        		    .then(newItem => {
                    				        				Trip
                    				        				.findOneAndUpdate(
                        				        				{_id: trip._id},
                        				        				{$push: {itineraryItems: newItem}},
                        				        				{new: true}
                    				        				)
                				        				    .then(finalTrip => {

                                            })
                                            .catch(err => {
                                                console.error(err);
                                                res.status(500).json({ error: 'Internal server error' });
                                            })
                                        console.log(newItem)
                                        console.log(newItem[0].flightNumber)    
                                        res.status(201).json(newItem[0].serialize()) 
                				        				})
                				        				.catch(err => {
              			                				console.error(err);
              			                				res.status(500).json({ error: 'Internal server error' });
              			              			})	
                                    }     
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
    const requiredFields = ['id', 'tripId'];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!(field in req.body)) {
            const message = `Missing \`${field}\` in request body`;
            console.error(message);
            return res.status(400).send(message);
        }
    }
    const toUpdate = {};
    const updateableFields = ['name', 'flightNumber', 'confirmed', 'price', 'foodType', 'pool', 'website', 'other', 'votes'];
    updateableFields.forEach(field => {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    ItineraryItem
        .findOneAndUpdate({_id: req.body.id}, toUpdate)
        .then(itineraryItem => {
            res.status(201).json(itineraryItem.serialize())
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        })
});

app.get('/votes/:id', (req, res) => {
    Vote
        .findById(req.params.id)
        .populate('user')
        .then(vote => {
          	res.status(200).json({
            		id: vote._id,
            		status: vote.status,
            		user: vote.user,
            		itineraryItem: vote.itineraryItem
          	})
        }) 	
        .catch(err => {
            console.error(err);
            res.status(500).json({message: "Internal server error"});
        });
});

//PUT endpoint for updating votes (by id)
app.put('/votes/:id', (req, res) => {
    const requiredFields = ['id'];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!(field in req.body)) {
            const message = `Missing \`${field}\` in request body`;
            console.error(message);
            return res.status(400).send(message);
        }
    }
    const toUpdate = {};
    const updateableFields = ['status'];
    updateableFields.forEach(field => {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    Vote
        .findOneAndUpdate({_id: req.body.id}, toUpdate, {new: true})
        .then(vote => {
            res.status(200).json({
                id: req.body.id,
                status: req.body.status
            })
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
    	})
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
        ItineraryItem
        .findById(req.body.itineraryItemId)
        .then(itineraryItem => {
            trip.itineraryItems.id(req.body.itineraryItemId).remove()
            trip.save();
            res.status(204).end()
        })
        .catch(err => res.status(500).json({ message: 'Internal server error' }));

        ItineraryItem
        .findOneAndDelete({_id: req.params.id})
  	    .then(trip => res.status(204).end())
  	    .catch(err => res.status(500).json({ message: 'Internal server error' }));
    })
    .catch(err => res.status(500).json({ message: 'Internal server error' }));    
});

//POST endpoint for invite a non user
app.post('/send-email', function (req, res) {
      let transporter = nodeMailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
              user: 'ourtineraryintive@gmail.com',
              pass: 'SashaB00ne'
          }
      });
      let mailOptions = {
          from: '"Andrea" ourtineraryintive@gmail.com', // sender address
          to: req.body.to, // list of receivers
          subject: "You have been invited to OURtinerary", // Subject line
          text: "Your friend [insert friend] has invited you to collaborate on a trip. Follow the link below to register with OURtinerary and get to planning!", 
          html: 
          `<p>Hi!</p><p>Your friend ${req.body.inviter} has invited you to collaborate on a trip called ${req.body.trip}. Follow the link below to register with OURtinerary and get to planning!</p><a href="https://stark-hamlet-54072.herokuapp.com"></a>`
      };
      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              return console.log(error);
          }
          console.log('Message %s sent: %s', info.messageId, info.response);
              res.status(200).end();
          });
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