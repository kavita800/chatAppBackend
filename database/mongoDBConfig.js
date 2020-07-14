const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
function mongoDbConnection(callback){
    MongoClient.connect('mongodb://localhost:27017/db/chat', (err, Database) => { 
        if(err) {
            console.log(err);
            return false;
        }
        console.log("Connect to the mongodb server");
        callback(Database);
   }); 
    
}

exports.mongoDbConnection = mongoDbConnection;
