const klass     = require('klass');
const AWS       = require('aws-sdk');
const crypto    = require('crypto');
const fs        = require('fs');

AWS.config.update({
  region: process.env.AWS_REGION, 
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3bucket = new AWS.S3( { params: { bucket: process.env.AWS_BUCKET } } )

var Storage = klass(function(options) {
  if (options.acl == undefined) {
    this.acl = 'public-read';
  } else {
    this.acl = options.acl;
  }
}).methods({

  stream: function(stream, key, next) {
    if (typeof stream == 'string') stream = fs.createReadStream(stream);
    var self = this;
    stream.on('open', function () {
      var params = {
        ACL:    self.acl, 
        Bucket: process.env.AWS_BUCKET, 
        Key:    key,
        Body:   stream
      };

      s3bucket.putObject(params, function(err, data){
        if (next) {
          console.log('finished streaming file', key);
          next(err, data);
        }
      });
    });
  },


  generateKey: function(fieldname, filename) {
    
    var now = new Date().getTime().toString();
    var extension = filename.split('.').pop();
    const hash = crypto.createHmac('sha256', fieldname+now)
      .update(filename)
      .digest('hex');

    var key = 'tmp/' + fieldname + "-" + hash + "." + extension;
    
    return key;
  },

  put: function(key, body, next) {
    var params = {
      ACL:    this.acl, 
      Bucket: process.env.AWS_BUCKET, 
      Key:    key, 
      Body:   body
    };

    s3bucket.putObject(params, function(err, data){
      if (next) {
        next(err, data);
      }
    });
  },

  get: function(key, next) {
    var params = {
      Bucket: process.env.AWS_BUCKET, 
      Key:    key 
    }

    s3bucket.getObject(params, function(err, data) {
      var data = data.Body.toString('utf-8'); 
      if (next) {
        next(err, data);
      }
    });
  },

  delete: function(key, next) {
    var params = {
      Bucket: process.env.AWS_BUCKET, 
      Key:    key 
    }

    s3bucket.deleteObject(params, function (err, data) {
      if (next) {
        next(err, key);
      }
    });
  },

  move: function(oldkey, key, next) {
    var bucket = process.env.AWS_BUCKET;
    var parameters = {
      Bucket:       bucket, 
      Key:          key, 
      CopySource:   bucket + '/' + oldkey
    };

    s3bucket.waitFor('objectExists', {Bucket: bucket, Key: oldkey}, function(err, data) {
      s3bucket.copyObject(parameters, function(err, data){
        console.log('copied', parameters, err, data);
        var params = {
          Bucket:     process.env.AWS_BUCKET, 
          Key:        oldkey
        };

        var deleteData;
        if (next) {
          next(err, {copy: data, delete: deleteData});
        }   
      });
    });
  }

})

module.exports = Storage;


