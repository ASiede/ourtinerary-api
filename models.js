"use strict"

const bcrypt = require('bcryptjs');
const mongoose = require("mongoose");

mongoose.Promise = global.Promise;

const voteSchema = mongoose.Schema({
    itineraryItem: {type: mongoose.Schema.Types.ObjectId, ref: 'ItineraryItem', required: true},
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    status: {type: String, default: ""}
})

const itineraryItemSchema = mongoose.Schema({
    type: {type: String, required: true},
    confirmed: {type: Boolean},
    flightNumber: {type: String},
    layovers: {type: String},
    length: {type: String},
    departureTimeArrivalTime: {type: String},
    name: {type: String},
    price: {type: String},
    location: {type: String},
    pool: {type: String},
    foodType: {type: String},
    website: {type: String},
    other: {type: String},
    votes: [{type: mongoose.Schema.Types.ObjectId, ref: 'Vote'}]
});

const userSchema = mongoose.Schema({
    username: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    firstName: {type: String, default: ""},
    lastName: {type: String, default: ""},
    email: {type: String, required: true, unique: true},
    trips:[{type: mongoose.Schema.Types.ObjectId, ref: 'Trip'}]
});


userSchema.methods.serialize = function() {
    return {
        id: this._id,
        username: this.username,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        trips: this.trips
    };
};

const tripSchema = mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    dates: {
      type: String,
      required: false
    },
    location: {
      type: String
    },
    tripLeader: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    collaborators:[{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    itineraryItems:[{type: mongoose.Schema.Types.ObjectId, ref: 'ItineraryItem'}]
    // itineraryItems:[itineraryItemSchema]
});



tripSchema.virtual('tripLeaderUsername').get(function() {
    return `${this.tripLeader.username}`
})

tripSchema.virtual('collaboratorUsernames').get(function() {
    return this.collaborators.map(collaborator => `${collaborator.username}`)
})

tripSchema.methods.serialize = function() {
    return {
        id: this._id,
        name: this.name,
        dates: this.dates,
        location: this.location,
        tripLeader: this.tripLeaderUsername,
        collaborators: this.collaboratorUsernames,
        itineraryItems: this.itineraryItems
    };  
};

itineraryItemSchema.methods.serialize = function() {
    return {
        id: this._id,
        type: this.type,
        confirmed: this.confirmed,
        flightNumber: this.flightNumber,
        layovers: this.layovers,
        length: this.length,
        departureTimeArrivalTime: this.departureTimeArrivalTime,
        name: this.name,
        price: this.price,
        location: this.location,
        pool: this.pool,
        foodType: this.foodType,
        website: this.website,
        other: this.other,
        votes: this.votes    
    }
}

voteSchema.methods.serialize = function() {
    return {
      id: this._id,
      status: this.status,
      user: this.user,
      itineraryItem: this.itineraryItem
    }
}

userSchema.methods.validatePassword = function(password) {
    return bcrypt.compare(password, this.password);
};

userSchema.statics.hashPassword = function(password) {
    return bcrypt.hash(password, 10);
};


const Trip = mongoose.model("Trip", tripSchema);
const User = mongoose.model("User", userSchema);
const ItineraryItem = mongoose.model("ItineraryItem", itineraryItemSchema, "itineraryItems");
const Vote = mongoose.model("Vote", voteSchema)

module.exports = { Trip, User, ItineraryItem, Vote };



