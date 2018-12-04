const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');

const expect = chai.expect;

const {Trip, User, ItineraryItem, Vote} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

const seedTrips = require('../db/trips');
const seedUsers = require('../db/users');
const seedItineraryItems = require('../db/itineraryItems');
const seedVotes = require('../db/votes');

chai.use(chaiHttp);

const { router: authRouter, localStrategy, jwtStrategy } = require('../auth');
const passport = require('passport');
passport.use(localStrategy);
passport.use(jwtStrategy);
const jwtAuth = passport.authenticate('jwt', { session: false });


// //Setting up for seeding trip data
function seedTripData() {
	console.info('seeding trip data');
	return Trip.insertMany(seedTrips);
}
// //Setting up for seeding user data
function seedUserData() {
	console.info('seeding user data');
	return User.insertMany(seedUsers);
}

// //Setting up for seeding itinerary items data
function seedItineraryItemData() {
	console.info('seeding itinerary item data');
	return ItineraryItem.insertMany(seedItineraryItems);
}

// //Setting up for seeding vote data
function seedVoteData() {
	console.info('seeding vote data');
	return Vote.insertMany(seedVotes);
}

function tearDownDb() {
	console.warn('Deleting database');
	return mongoose.connection.dropDatabase();
}

describe('API', function() {
	this.timeout(15000);
	before(function() {
		return runServer(TEST_DATABASE_URL);
	});
	beforeEach(function() {
		return seedTripData();
	});
	beforeEach(function() {
		return seedUserData();
	});
	beforeEach(function() {
		return seedItineraryItemData();
	});
	beforeEach(function() {
		return seedVoteData();
	});

	afterEach(function() {
	return tearDownDb();
	});

	after(function() {
	return closeServer();
	});	
// 	//GET endpoint for trips
	describe('GET endpoint', function() {

	    it('should return all existing trips', function() {
		    let res;
		    return chai.request(app)
		    .get('/trips')
		    .then(function(_res) {
		        res = _res;
		        expect(res).to.have.status(200);
		        expect(res).to.be.json;
		        expect(res.body.trips).to.be.a('array');
		        expect(res.body.trips).to.have.lengthOf.at.least(1);
		        return Trip.countDocuments();
		    })
		    .then(function(count) {
		        expect(res.body.trips).to.have.lengthOf(count);
		    });
	    });

	    it('should return trips with right fields', function() {
	    	let resTrip;
	    	return chai.request(app)
	        .get('/trips')
	        .then(function(res) {
	        	res.body.trips.forEach(function(trip) {
	            	expect(trip).to.be.a('object');
	            	expect(trip).to.include.keys(
	              'id', 'name', 'dates', 'location', 'tripLeader', 'collaborators', 'itineraryItems');
	          	});
	        	resTrip = res.body.trips[0];
	        	return Trip.findById(resTrip.id);
	        })
	        .then(function(trip) {
	        	expect(resTrip.id).to.equal(trip.id);
	        	expect(resTrip.name).to.equal(trip.name);
	        	expect(resTrip.dates).to.equal(trip.dates);
	        	expect(resTrip.location).to.equal(trip.location);
	        	// could be iimproved
	        	expect(resTrip.tripLeader).to.be.a('string');
	        	// could be iimproved
	        	expect(resTrip.collaborators).to.be.a('array');
	        	// could be iimproved
	        	expect(resTrip.itineraryItems).to.be.a('array');
	        });
	    });

	    it('should return the right trip when getting by id', function() {
	    	let trip;
	    	return Trip
	    		.findOne()
	    		.then(function(_trip) {
	    			trip = _trip;
	    			return chai.request(app).get(`/trips/${trip.id}`);
	    		})
	    		.then(function(res) {
	    			expect(res).to.have.status(200);
	        		expect(res).to.be.json;
	        		return Trip.findById(trip.id)
	    		})
	    		.then(function(_trip) {
	    			expect(_trip.id).to.equal(trip.id)
	    		}) 
	    });
  	});

//  //POST endpoint for trips
	describe('POST endpoint', function() {
	    it('should add a new trip', function() {
	    	const userData = {"username": "Bebe", "password": "passwordpassword"}  
        	const newTrip = {
              			name: "Beach Getaway",
              			dates: "2/2/20-3/2/20",
              			location: "Key West",
              			tripLeader: "4b958af16bfe8fba53fb5fc6",
              			collaborators: ["7b958af16bfe8fba53fb5fc6"]
              		}
            //register new user first
	  		return chai.request(app)
	    	.post('/users')
	    	.send(userData)
	    	.then(function(res) { 		
            	//authorize user   		
	        	return chai.request(app)
	            	.post('/auth/login')
	            	.send(userData)
	            	.then(function(res) {
	              		return chai.request(app)
	              		.post('/trips')
	              		.send(newTrip)
	              		.then(function(res) {
		                    expect(res).to.have.status(201);
		                    expect(res).to.be.json;
		                    expect(res.body).to.be.a('object');
		                    expect(res.body).to.include.keys(
		                      'id', 'name', 'dates', 'location', 'tripLeader', 'collaborators', 'itineraryItems');
		                    expect(res.body.id).to.not.be.null;
		                    expect(res.body.name).to.equal(newTrip.name);
		                    expect(res.body.dates).to.equal(newTrip.dates);
		                    expect(res.body.location).to.equal(newTrip.location);
		                    // could be improved
		                    expect(res.body.tripLeader).to.be.a('string');
		                    //could be improved
		                    expect(res.body.collaborators).to.be.a('array');
		                    //could be improved
		                    expect(res.body.itineraryItems).to.be.a('array');
		     				return Trip.findById(res.body.id);
	              		})
		                .then(function(trip) {
		                    expect(trip.name).to.equal(newTrip.name);
		                    expect(trip.dates).to.equal(newTrip.dates);
		                    expect(trip.location).to.equal(newTrip.location);
	          			})
	        		})  
	        }); 		   
	    });
  	});

//  //PUT endpoint for trips
	describe('PUT endpoint', function() {
	    it('should update fields you send', function() {
	    	const updateData = {
	        	name: 'Updated name'
	      	};
	      	return chai.request(app)
	        .get('/trips')
	        .then(function(res) {
	        	updateData.id = res.body.trips[0].id;
	        	return chai.request(app)
	            .put(`/trips/${res.body.trips[0].id}`)
	            .send(updateData);
	        })
	        .then(function(res) {
	        	expect(res).to.have.status(201);
	        	return Trip.findById(updateData.id);
	        })
	        .then(function(trip) {
	        	expect(trip.name).to.equal(updateData.name);
	        });
	    });
  	});   

// //DELETE endpoint for trips
	describe('DELETE endpoint', function() {
    	it('delete a trip by id', function() {
	      	let trip;
	      	return Trip
	        .findOne()
	        .then(function(_trip) {
	         	trip = _trip;
	         	return chai.request(app).delete(`/trips/${trip.id}`);
	        })
	        .then(function(res) {
	        	expect(res).to.have.status(204);
	        	return Trip.findById(trip.id);
	        })
	        .then(function(_trip) {
	        	expect(_trip).to.be.null;
	        });
    	});
  	});

// 	//GET endpoint for users
 	describe('GET endpoint', function() {
 		it('should return all users', function() {
 			let res;
		    return chai.request(app)
		    .get('/users')
		    .then(function(_res) {
		        res = _res;
		        expect(res).to.have.status(200);
		       	return User.countDocuments();
		    })
		    .then(function(count) {
		        expect(res.body.users).to.have.lengthOf(count);
		    });
 		})
 		it('should return the right user when getting by id', function() {
	    	let user;
	    	return User
	    		.findOne()
	    		.then(function(_user) {
	    			user = _user;
	    			return chai.request(app).get(`/users/${user.id}`);
	    		})
	    		.then(function(res) {
	    			expect(res).to.have.status(200);
	        		expect(res).to.be.json;
	        		return User.findById(user.id)
	    		})
	    		.then(function(_user) {
	    			expect(_user.id).to.equal(user.id)
	    		}) 
	    });
 	});
 	
// 	//POST endpoint for users
	describe('POST endpoint', function() {
    	it('should add a new user', function() {
      		const userData = {"username": "JDoe", "password": "passwordpassword","email": "emai@email.com", "firsName": "John", "lastName": "Doe"}
      		return chai.request(app)
        	.post('/users')
        	.send(userData)
        	.then(function(res) {         
          		expect(res).to.have.status(201);
          		expect(res).to.be.json;
          		expect(res.body).to.be.a('object');
          		expect(res.body.id).to.not.be.null;
          		expect(res.body.username).to.equal(userData.username);
      		});
    	});
  	});

// 	//POST endpoint for authorization of users login
	// describe('POST endpoint', function() {
 //    	it('should log in an existing user', function() {
 //      		//register new user first
	//       	const userData = {"username": "Rupaul", "password": "passwordpassword"}
	//   		return chai.request(app)
	//     	.post('/users')
	//     	.send(userData)
	//     	.then(function(res) {
	//        		return chai.request(app)
	//         	.post('/auth/login/')
	//         	.send(userData)
	//         	.then(function(res) {
	//             	expect(res).to.have.status(200);
	//           	})
	//     	});
 //    	});
 //  	});
});  	

