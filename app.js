const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();
const convertUserJsonObjectTodoResponse = (dbObject) => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    username: dbObject.username,
    password: dbObject.password,
    gender: dbObject.gender,
  };
};

const convertFollowerJsonObjectToDbResponse = (dbObject) => {
  return {
    followerId: dbObject.follower_id,
    followerUserId: dbObject.follower_user_id,
    followingUserId: dbObject.following_user_id,
  };
};

const convertTweetTableJsonObjectToDbResponse = (dbObject) => {
  return {
    tweetId: dbObject.tweet_id,
    tweet: dbObject.tweet,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};
const convertReplyTableJsonObjectToDbResponse = (dbObject) => {
  return {
    replyId: dbObject.reply_id,
    tweetId: dbObject.tweet_id,
    reply: dbObject.reply,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const convertLikeTableJsonObjectToDbResponse = (dbObject) => {
  return {
    likeId: dbObject.like_id,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.loggedUserId = payload.loggedUserId;
        next();
      }
    });
  }
};
// API login TEST CASES PASSED

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
        loggedUserId: dbUser.user_id,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
// API /register/ NOT PASSED BUT GETTING desired response

app.post("/register/", authenticateToken, async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserQuery = `
  SELECT * FROM user WHERE username = '${username}'`;
  const dbResponse = await db.get(getUserQuery);
  if (dbResponse === undefined) {
    if (password.length < 6) {
      response.status(400).send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
    INSERT INTO
     user (username, password, name, gender)
    VALUES (
        '${username}',
       ' ${hashedPassword}',
       ' ${name}',
       ' ${gender}'

    ); `;
      await db.run(createUserQuery);
      response.send("User successfully added");
    }
  } else {
    response.status(400).send("User already exists");
  }
});

// API /user/tweets/feed/ TEST CASES PASSED

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getFollowingUserId = `
  SELECT following_user_id FROM follower  `;
  const dbResponseFollowing = await db.all(getFollowingUserId);
  const followingUserIds = dbResponseFollowing.map(
    (row) => row.following_user_id
  );
  const tweetsQuery = `
  SELECT username ,tweet , date_time FROM tweet INNER JOIN user ON tweet.user_id = user.user_id
   WHERE tweet.user_id IN (${followingUserIds.join(",")})
    ORDER BY date_time DESC 
    LIMIT 4
     ;
  `;
  const tweetsRows = await db.all(tweetsQuery);
  response.send(
    tweetsRows.map((eachRow) => {
      return {
        username: eachRow.username,
        tweet: eachRow.tweet,
        dateTime: eachRow.date_time,
      };
    })
  );
  console.log(followingUserIds.join(","));
});

//API /user/following/ NOT PASSED BUT GETTING desired response

app.get("/user/following/", authenticateToken, async (request, response) => {
  const loggedUserId = request.loggedUserId;
  const getFollowingUserId = `
  SELECT * FROM follower where follower_user_id = '${loggedUserId}' `;
  const dbResponseFollowing = await db.all(getFollowingUserId);
  const followingUserIds = dbResponseFollowing.map(
    (row) => row.following_user_id
  );
  console.log(followingUserIds);
  const tweetsQuery = `
  SELECT username  FROM user
   WHERE user.user_id IN (${followingUserIds.join(",")})
     ;
  `;
  const tweetsRows = await db.all(tweetsQuery);
  response.status(200).send(
    tweetsRows.map((eachRow) => {
      return {
        name: eachRow.username,
      };
    })
  );
});
// API /user/followers/ NOT PASSED BUT GETTING desired response

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const loggedUserId = request.loggedUserId;
  const getFollowerUserId = `
  SELECT follower_user_id FROM follower where following_user_id = '${loggedUserId}' `;
  const dbResponseFollower = await db.all(getFollowerUserId);
  const followerUserIds = dbResponseFollower.map((row) => row.follower_user_id);
  const followerUsernameQuery = `
    SELECT username  FROM user
    WHERE user.user_id IN (${followerUserIds.join(",")})
        ;
    `;
  const dbResponseUsername = await db.all(followerUsernameQuery);
  response.status(200).send(
    dbResponseUsername.map((eachRow) => {
      return {
        name: eachRow.username,
      };
    })
  );
});

// API 6 processing
/*
app.get("/tweets/:tweetId/:", authenticateToken, async (request, response) => {
  const loggedUserId = request.loggedUserId;
  const getFollowingUserId = `
  SELECT * FROM follower where follower_user_id = '${loggedUserId}' `;
  const dbResponseFollowing = await db.all(getFollowingUserId);
  const followingUserIds = dbResponseFollowing.map(
    (row) => row.following_user_id
  );
  const followingTLRQuery = `
   SELECT tweet , count(like_id),count(reply_id),date_time 
   FROM (tweet INNER JOIN like ON tweet.user_id = like.user_id) AS T INNER JOIN reply ON T.user_id = reply.user_id
   WHERE tweet.user_id IN (${followingUserIds.join(",")}) ;
   `;
  const dbResponseTLR = await db.get(followingTLRQuery);
});
*/

module.exports = app;
