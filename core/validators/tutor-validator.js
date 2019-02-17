const Joi = require('Joi');

//  General schema and function required for post request
const postSchema = {
    firstName: Joi.string().min(3).required(),
    lastName: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(7).required(),
    institution: Joi.string().required(),
    semester: Joi.number().integer(),
    img: Joi.string().required(),
    description: Joi.string().required(),
    category: Joi.string().required(),
    gpa: Joi.number()
};

function validatePostInput(input) {
    return Joi.validate(input, postSchema);
}

// General schema and function for authenticating tutors
const authenticationSchema = {
    email: Joi.string().email().required(),
    password: Joi.string().min(7).required(),
};

function validateAuthentication(request) {
    return Joi.validate(request, authenticationSchema);
}

module.exports.postValidation = validatePostInput;
module.exports.validateAuthentication = validateAuthentication;