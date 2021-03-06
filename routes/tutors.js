const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');

const auth = require('../middleware/tutor-auth');
const Tutor = require('./../model/tutor');
const Class = require('./../model/class');
const Review = require('./../model/review');
const Report = require('./../model/report');
const Booking = require('./../model/booking');
const Student = require('./../model/student');

const { classValidation, reportValidation } = require('./../core/validators/tutor-validator');
const { hashPassword } = require('./../core/password-hasher');


/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*       Creates a Tutor and stores it in the database
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
//  Constants for image storage
const storage = multer.diskStorage({
    destination: function (req, res, cb) {
        cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now())
    }
});
const upload = multer({ storage: storage });

router.post('/signup', upload.single('img'),  (req, res) => {
    try {
        hashPassword(req.body.password)
         // We have to hash the password first
         .then(hashedPassword => {
             // Creating a new instance of the model tutor and the hashed password
            const tutor = new Tutor;
            tutor.firstName = req.body.firstName;
            tutor.lastName =  req.body.lastName;
            tutor.email = req.body.email;
            tutor.password = hashedPassword;
            tutor.institution = req.body.institution;
            tutor.semester =  req.body.semester;
            tutor.description = req.body.description;
            tutor.category =  req.body.category;
            tutor.gpa = req.body.gpa;
            // Image data
            tutor.img.data = fs.readFileSync(req.file.path);
            tutor.img.contentType = 'image/jpeg';
            // Saving function, async function
            tutor.save()
             .then(tutor => {
                const token = tutor.generateToken();
                res.header('x-auth-token',token).send(tutor);
            })
             .catch(error => {
                 res.status(400).send(error.message)
                });

         });
    } catch(error) {
        res.status(400).send(error.message);
    }
});


/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*       Checks if an email is in use
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
//  No need for middleware
router.post('/email', (req, res) => {
    Tutor.find({
        email: req.body.tutor_email
    })
     .then(record => {
         // We want to know whether the record was found or not
         if(record.length > 0) return res.send({found: true});
         res.send({found: false});
     })
     .catch(error => {
         res.status(404).send(error);
     });
});

/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*       Fetches all available classes from the tutor given an id
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
router.get('/classes', auth, (req, res) => {
    Class.find({ tutor: req.tutor._id, availability: true})
     .then(classes => {
        res.json(classes)
     })
     .catch(error => res.json(400).send(error.message));
});

router.get('/userinfo', auth, (req, res) => {
Tutor.find({  _id: req.tutor._id})
     .then(userinfo => {
        res.json(userinfo)
     })
     .catch(error => res.status(400).send(error.message));
});

/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*        Creates a new class for a tutor, given the tutor's id 
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
router.post('/class', auth, (req, res) => {
     Tutor.findOne({ _id: req.tutor._id })
     .then( async tutor => {
         const newClass = new Class({
             tutor: req.tutor._id,
             tutor_rating: await tutor.getAverageRating(),
             name: req.body.name,
             date: req.body.date,
             subject: req.body.subject,
             area: req.body.area,
             description: req.body.description,
             cost: req.body.cost
         });

         newClass.save()
          .then(newClass => {
             res.json(newClass);
         })
          .catch(error => res.status(400).send(error.message));
     })
});

/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*       Bulk fetch of classes by ids
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
router.get('/class', auth, (req, res) => {
    const ids = req.query.ids
    Class.find({
        _id :{ $in : ids }
    })
        .then(data => {
            res.send(data);
        })
        .catch(error => res.status(404).send(error));
});

/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*        Fetches all future scheduled classes
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
router.get('/scheduled', auth, (req, res) => {
    const today = new Date();
    const tutor  = req.tutor;
    Booking.find({
        tutor : tutor._id,
        status : 'Accepted' 
    })
     .then(bookings => {
         let class_ids = [];
         bookings.forEach(b => class_ids.push(b.booked_class))
         Class.find({
              _id : { $in : class_ids},
              date : { $gte : today}
         })
         .then(data => {
            res.json(data);
         })
         .catch(error => res.status(404).send(error))
     })
     .catch( error => res.status(404).send(error));
});

/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*        Cancels a class given the class id
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
router.put('/cancel-class/:id', auth, (req, res) => {
    Class.findByIdAndUpdate(req.params.id, {
        availability: false
    }, { new: true })
     .then(canceledClass => {
        res.json(canceledClass);
    })
     .catch(error => res.status(400).send(error.message));
});


/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*       Updates class given the class id
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
router.put('/class/:id', auth, (req, res) => {
    var { error } = classValidation(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    Class.findByIdAndUpdate(req.params.id, {
        name: req.body.name,
        date: req.body.date,
        subject: req.body.subject,
        area: req.body.area,
        availability: req.body.availability,
        description: req.body.description,
        cost: req.body.cost
    }, { new: true })
     .then(updatedClass => {
        res.json(updatedClass);
     })
     .catch(error => res.status(400).send(error.message));
});

/*  *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *
*
*        Fetches reviews
*
*   *   *   *   *   *   *   *   *   *   *   *   *   *   *   *   */
router.get('/reviews', auth, (req, res) => {
    Review.find({ tutor: req.tutor._id})
     .then(reviews => {
         if(reviews.length === 0) res.json([]);
         var students = reviews.map(review => { return review.student });
         var classes = reviews.map(review => { return review.class });
         Student.find({_id: {$in: students}})
          .then( students_records => {
              Class.find({_id : {$in: classes}})
               .then( class_records => {
                   stdnt_map = students_records.map(s => ({name: s.firstName+" "+s.lastName, student: s._id}) );
                   class_map = class_records.map(c => ({name: c.name, class: c._id}));
                   var data = [];
                   let size = 0;
                   reviews.forEach(review => {
                       var student = stdnt_map.find(elem => { return JSON.stringify(elem.student) === JSON.stringify(review.student)});
                       var r_class = class_map.find(elem => { return JSON.stringify(elem.class) === JSON.stringify(review.class)});
                       const response = {
                            student : student.name,
                            class : r_class.name,
                            comment : review.comment,
                            stars: review.stars,
                            date: review.date,
                            _id: review._id
                       }
                       data.push(response);
                       size++;
                       if(size === reviews.length) res.json(data);
                   })
               })
          })

     })
     .catch(error => res.json(400).send(error.message));
});

//          R  E  P  O  R  T  S
router.post('/report-review/:id', auth, (req, res) =>{
    //Check first the input of the user
    var { error } = reportValidation(req.body);
    if (error) throw new Error(error.details[0].message);

    Review.findOne({ _id: req.params.id }).then( review => {
        const report = new Report({
            review: review._id,
            tutor: req.tutor._id,
            description: req.body.description
        });

        report.save()
         .then(review => {
            res.json(report);
        })
         .catch(error => res.status(400).send(error.message));
    })
    .catch(error => res.status(404).send(error.message));
});

//Date Filter
router.get('/search/classes', auth, (req, res) => {
    Class.find({tutor: req.tutor._id, 
        date:{
            $gte: req.body.startDate, 
            $lt: req.body.endDate
        }})
    .then(matches => {
        res.json(matches);
     })
     .catch(error => res.status(400).send(error.message));
});

module.exports = router;
