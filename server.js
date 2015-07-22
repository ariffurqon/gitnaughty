// require express and other modules
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    User = require('./models/user'),
    session = require('express-session'),
    db = require ('./models/post');

// connect to mongodb
mongoose.connect(
  process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/gitnaughty'
);

// middleware
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + '/public'));

app.use(session({
  saveUninitialized: true,
  resave: true,
  secret: 'SuperSecretCookie',
  cookie: { maxAge: 60000 }
}));

// middleware to manage sessions
app.use('/', function (req, res, next) {
  // saves userId in session for logged-in user
  req.login = function (user) {
    req.session.userId = user.id;
  };

  // finds user currently logged in based on `session.userId`
  req.currentUser = function (callback) {
    User.findOne({_id: req.session.userId}, function (err, user) {
      req.user = user;
      callback(null, user);
    });
  };

  // destroy `session.userId` to log out user
  req.logout = function () {
    req.session.userId = null;
    req.user = null;
  };

  next();
});

// STATIC ROUTES

// homepage
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/views/index.html');
});

// profile page
app.get('/profile', function (req, res) {
  // check for current (logged-in) user
  req.currentUser(function (err, user) {
    // show profile if logged-in user
    if (user) {
      res.sendFile(__dirname + '/public/views/profile.html');
    // redirect if no user logged in
    } else {
      res.redirect('/');
    }
  });
});

// AUTH ROUTES (SIGN UP, LOG IN, LOG OUT)

// create new user with secure password
app.post('/users', function (req, res) {
  var newUser = req.body.user;
  User.createSecure(newUser, function (err, user) {
    console.log("new User", newUser);
    // log in user immediately when created
    req.login(user);
    console.log("Logged in!")
    res.redirect('/profile');
  });
});

// authenticate user and set session
app.post('/login', function (req, res) {
  var userData = req.body.user;
  User.authenticate(userData.email, userData.password, function (err, user) {
    req.login(user);
    res.redirect('/profile');
  });
});

// log out user (destroy session)
app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/');
});

// API ROUTES

// get all posts
app.get('/api/posts', function (req, res) {
  // find all posts from the database and
  // populate all of the post's author information
  db.Post.find().exec(function(err, posts){
    if (err){
      console.log("! error: ", err);
      res.status(500).send(err);
    } else {
      // send all posts as JSON response
      res.json(posts); 
    }
  });
});

// create new post
app.post('/api/posts', function (req, res) {
  // use params (author and text) from request body

  // create the author (we'll assume it doesn't exist yet)
  var newAuthor = new db.Author({
    name: req.body.author
  });
  newAuthor.save();

  // create a new post
  var newPost = new db.Post({
    author: newAuthor._id,
    text: req.body.text
  });

  // save new post in db
  newPost.save(function (err, savedPost) { 
    if (err) {
      console.log("error: ",err);
      res.status(500).send(err);
    } else {
      // once saved, send the new post as JSON response
      res.json(savedPost);
    }
  });
});

// get a single post 
app.get('/api/posts/:id', function(req, res) {

  // take the value of the id from the url parameter
  // note that now we are NOT using parseInt
  var targetId = req.params.id

  // find item in database matching the id
  db.Post.findOne({_id: targetId}, function(err, foundPost){
    console.log(foundPost);
    if(err){
      console.log("error: ", err);
      res.status(500).send(err);
    } else {
      // send back post object
      res.json(foundPost);
    }
  });

});



// update single post
app.put('/api/posts/:id', function(req, res) {

  // take the value of the id from the url parameter
  var targetId = req.params.id;

  // find item in `posts` array matching the id
  db.Post.findOne({_id: targetId}, function(err, foundPost){
    console.log(foundPost); 

    if(err){
      res.status(500).send(err);

    } else {
      // update the post's author
      foundPost.author = req.body.author;

      // update the post's text
      foundPost.text = req.body.text;

      // save the changes
      foundPost.save(function(err, savedPost){
        if (err){
          res.status(500).send(err);
        } else {
          // send back edited object
          res.json(savedPost);
        }
      });
    }

  });

});

// delete post
app.delete('/api/posts/:id', function(req, res) {

  // take the value of the id from the url parameter
  var targetId = req.params.id;

 // remove item from the db that matches the id
   db.Post.findOneAndRemove({_id: targetId}, function (err, deletedPost) {
    if (err){
      res.status(500).send(err);
    } else {
      // send back deleted post
      res.json(deletedPost);
    }
  });
});


// get all comments for one post
app.get('/api/posts/:postid/comments', function(req, res){
  // query the database to find the post indicated by the id
  db.Post.findOne({_id: req.params.postid}, function(err, post){
    // send the post's comments as the JSON response
    res.json(post.comments);
  });
});

// add a new comment to a post
app.post('/api/posts/:postid/comments', function(req, res){

  // query the database to find the post indicated by the id
  db.Post.findOne({_id: req.params.postid}, function(err, post){
    // create a new comment record
    var newComment = new db.Comment({text: req.body.text});

    // add the new comment to the post's list of embedded comments
    post.comments.push(newComment);

    // send the new comment as the JSON response
    res.json(newComment);
  });
});

// get all authors
app.get('/api/authors', function(req, res){
  // query the database to find all authors
  db.Author.find({}, function(err, authors){
    // send the authors as the JSON response
    res.json(authors);
  });
}); 

// create a new author
app.post('/api/authors', function(req, res){
  // make a new author, using the name from the request body
  var newAuthor = new db.Author({name: req.body.name});

  // save the new author
  newAuthor.save(function(err, author){
    // send the new author as the JSON response
    res.json(author);
  });
});


// assign a specific author to a specific post

app.put('/api/posts/:postid/authors/:authorid', function(req, res){
  // query the database to find the author 
  // (to make sure the id actually matches an author)
  db.Author.find({_id: req.params.authorid}, function(err, author){
    if (err){
      console.log("error: ", err);
      res.status(500).send("no author with id "+req.params.authorid);
    } else {
      // query the database to find the post
      db.Post.find({_id: req.params.postid}, function(err, post){

        if (err){  
          res.status(500).send("no post with id"+req.params.postid);
        } else {  // we found a post!
          // update the post to reference the author
          post.author = author._id;

          // save the updated post
          post.save(function(err, savedPost){
            // send the updated post as the JSON response
            res.json(savedPost);
          });
        }
      });
    }
  });
});




app.listen(process.env.PORT || 3000);

// listen on port 3000
// app.listen(process.env.PORT || 3000, function () {
//   console.log('magic happens and server started on localhost:3000 helloooo...');
// });