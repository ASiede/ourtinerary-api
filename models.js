"use strict"

const bcrypt = require('bcryptjs');
const mongoose = require("mongoose");

mongoose.Promise = global.Promise;

const votesSchema = mongoose.Schema({

});

const itineraryItemSchema = mongoose.Schema({
    type: {type: String},
    name: {type: String, required: true},
    confirmed: {type: Boolean},
    price: {type: String},
    location: {type: String},
    website: {type: String},
    votes: {type: Array}
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
    trips:[{type: mongoose.Schema.Types.ObjectId, ref: 'Trip'}]
});

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
    itineraryItems:[itineraryItemSchema]
});



userSchema.methods.serialize = function() {
    return {
        id: this._id,
        username: this.username,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        tripsById: this.trips
    };
};

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
        id: this.id,
        type: this.type,
        name: this.name,
        confirmed: this.confirmed,
        price: this.price,
        location: this.location,
        website: this.website,
        votes: this.votes    
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
const ItineraryItem = mongoose.model("ItineraryItem", itineraryItemSchema);

module.exports = { Trip, User, ItineraryItem };



