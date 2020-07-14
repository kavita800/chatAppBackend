/**
 *  Node Js APP Server js
 *  By this we can create our own node js chat server.
 */
const express = require('express');
const bodyParser = require('body-parser');
const socket = require('socket.io');
var ObjectId = require('mongodb').ObjectId
const port = 9000;
var mongoDBConfig = require("./database/mongoDBConfig.js");
const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin' , '*');
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.append("Access-Control-Allow-Headers", "Origin, Accept,Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
    res.append('Access-Control-Allow-Credentials', true);
    next();
});

let usersModal, count, groups, groupsUsers;

mongoDBConfig.mongoDbConnection(function(Database) {
    const db = Database.db("chatdb");
    usersModal = db.collection("users"); // Add your Collection Name here
    groups = db.collection("chatgroups");// Add your Collection Name here
    groupsUsers = db.collection("usergroups"); // Add your Collection Name here
    // Code for run server with 9000 port
    const server = app.listen(port, () => {
     console.log("Node server start with " + port + "...");
    });


    // Create Socket connect for chat.
    const io = socket.listen(server);

    // create socket connection here and prepare group using user id
    io.sockets.on('connection', (socket) => {
        socket.on('join', (data) => {
            socket.join(data.room);
            groups.find({}).toArray((err, rooms) => {
                if(err){
                    console.log(err);
                    return false;
                }
                count = 0;

                rooms.forEach((room) => {
                    if(room.name == data.room){
                        count++;
                    }
                });
                if(count == 0) {
                    groups.insert({ name: data.room, messages: [] }); 
                }
            });
        });
        socket.on('message', (data) => {
            io.in(data.room).emit('new message', {user: data.user, message: data.message, message: data.message, date: new Date(Date.now()).toISOString()});
            groups.update({name: data.room}, { $push: { messages: { user: data.user, message: data.message, date: new Date(Date.now()).toISOString() } } }, (err, res) => {
                if(err) {
                    console.log(err);
                    return false;
                }
                console.log("Document updated");
            });
        });
        socket.on('typing', (data) => {
            let socketsData = {data: data, isTyping: true}
            if(!data.isTyping) {
                socketsData.isTyping = false;
            }
            socket.broadcast.in(data.room).emit('typing', socketsData);
        });
    });
});

app.get('/', (req, res, next) => {
    res.send('Welcome to chat server....');
});

app.post('/api/signup', (req, res, next) => {
    let user = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password
    };
   
    usersModal.find({email : user.email}).toArray((err, Users) => {
        if (err) {
            return res.status(500).send(err);
        }
        if(Users.length === 0){
            usersModal.insert(user, (errs, User) => {
                if(errs){
                    res.send(errs);
                }
                res.json(User);
            });
        }
        else {
            res.json({ user_already_signed_up: true });
        }
    });
    
});

app.post('/api/signin', (req, res) => {
    let isPresent = false;
    let correctPassword = false;
    let isUserInUser;
    let users = {
        email : req.body.email,
        password: req.body.password
    };
    usersModal.find(users).toArray((err, usersDa) => {
        if(err) return res.send(err);
            if(usersDa.length > 0) {
                isPresent = true;
                correctPassword = true;
                isUserInUser = {
                    email : usersDa[0].email, 
                    username : usersDa[0].username,
                    id : usersDa[0]._id
                }
            }
            res.json({ isPresent: isPresent, correctPassword: correctPassword, user: isUserInUser });
    });
});

app.get('/api/users', (req, res, next) => {
    usersModal.find({}, {username: 1, email: 1, _id: 0}).toArray((err, users) => {
        if(err) {
            res.send(err);
        }
        res.json(users);
    });
});

app.get('/api/chat/:room', (req, res, next) => {
    let room = req.params.room;
    groups.find({name: room}).toArray((err, chatroom) => {
        if(err) {
            console.log(err);
            return false;
        }
      chatroom.length >0 ? res.json(chatroom[0].messages) : res.json(chatroom);
    });
});

app.post('/api/createroom', (req, res, next) => {
    let group = {
        name: req.body.name.trim(),
        createdby : req.body.userId,
        messages: []
    };
    let members =  req.body.members;
   groups.find({name : group.name}).toArray((err, data) => {
        if (err) {
            return res.status(500).send(err);
        }
        if(data.length === 0){
            groups.insert(group, (err, gdata) => {
                if(err){
                    res.send(err);
                }
               
                let gList = [];
                const groupId = gdata && gdata.insertedIds && gdata.insertedIds[0];
                if(members.length > 0) {
                    members.forEach(element => {
                       const temp = {groupId : groupId, memberId : element};
                       gList.push(temp);
                    });
                    groupsUsers.insertMany(gList, (err, results) => {
                        res.json(gdata); 
                    });
                } else {
                    res.json(gdata); 
                }
            });
        }
        else {
            res.json({ group_exits: true });
        }
    });
});

app.get('/api/groups/:memberId', (req, res, next) => {
    let memberId = req.params.memberId;
    groupsUsers.find({memberId:memberId}, {groupId: 1, memberId: 1, _id: 0}).toArray((err, groupInfo) => {
        if(err) {
            res.send(err);
        }
        if(groupInfo.length > 0) {
            let count = 0;
            groupInfo.forEach((element, key) => {
                groups.find({_id:element.groupId}, {name: 1, _id: 0}).toArray((err, groupNameInfo) => {
                    if(err) {
                        res.send(err);
                    }
                   if(groupNameInfo.length > 0){ 
                    groupInfo[key].name = groupNameInfo[0].name;
                   }
                   count++;
                    if(groupInfo.length === count) {
                        res.json(groupInfo);
                    }
                });
            });
           
        } else {
            res.json(groupInfo);
        }
    });
});

app.get('/api/groupinfo/:room', (req, res, next) => {
    let room = req.params.room;
    groups.find({name: room}).toArray((err, chatroom) => {
        if(err) {
            console.log(err);
            return false;
        }
        console.log(room)
        if(chatroom.length > 0) {
            chatroom[0].members = [];
            usersModal.find({_id:ObjectId(chatroom[0].createdby)}, {_id: 1, name: 0}).toArray((err, users) => {
                if(err) {
                    res.send(err);
                } 
                chatroom[0].createdbyname = users.length > 0 ? users[0].username : '';
               // res.json(chatroom[0])
            });

            groupsUsers.find({groupId:ObjectId(chatroom[0]._id)}, {groupId: 1, memberId: 1, _id: 0}).toArray((err, groupInfo) => {
                if(err) {
                    res.send(err);
                }
                if(groupInfo.length > 0) {
                    let count = 0;
                    groupInfo.forEach((element, key) => {
                        usersModal.find({_id:ObjectId(element.memberId)}, {_id: 1, name: 0}).toArray((err, users) => {
                            if(err) {
                                res.send(err);
                            } 
                            if(users.length > 0 ) {
                              let members = { name : users[0].username};
                              chatroom[0].members.push(members)
                            }
                            count++;
                            if(groupInfo.length === count) {
                                res.json(chatroom[0])
                            }
                        });
                    });
                }
            });

        } else {
            res.json({});
        }
    });
});