const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
let database = null;
const initializeDBandServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DataBase error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBandServer();

// JwtToken Verification
const authenticateToken = (request, response, next) => {
  const { tweet } = request.body;
  const { tweetId } = request.params;
  let jwtToken;
  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.payload = payload;
        request.tweetId = tweetId;
        request.tweet = tweet;
        next();
      }
    });
  }
};

// API 1: REGISTER
app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;

  // Check if the username already exists
  const checkUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await database.get(checkUserQuery);

  if (dbUser) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
        INSERT INTO 
          user (name, username, password, gender) 
        VALUES(
          '${name}', 
          '${username}', 
          '${hashedPassword}', 
          '${gender}'
        );`;
      await database.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

// API 2: LOGIN
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectedQuery = `SELECT * FROM user WHERE username = '${username}';`;
  console.log(username, password);
  const dbUser = await database.get(selectedQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const jwtToken = jwt.sign(dbUser, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// User Tweets Feed API - 3
app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const getTweetFeedQuery = `
    SELECT 
      username, 
      tweet,
      date_time AS dateTime 
    FROM 
      follower 
      INNER JOIN tweet ON follower.following_user_id = tweet.user_id 
      INNER JOIN user ON user.user_id = follower.following_user_id 
    WHERE 
      follower.follower_user_id = ${user_id} 
    ORDER BY 
      date_time DESC 
    LIMIT 4 ;`;
  const tweetFeedArray = await database.all(getTweetFeedQuery);
  response.send(tweetFeedArray);
});

// Get User following names API - 4
app.get("/user/following", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const userFollowerQuery = `
    SELECT
      name
    FROM 
      user 
      INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE 
      follower.follower_user_id = ${user_id};`;
  const userFollowsArray = await database.all(userFollowerQuery);
  response.send(userFollowsArray);
});

// List of names whom user API follows - API 5
app.get("/user/followers", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const userFollowersQuery = `
    SELECT 
      name 
    FROM 
      user 
      INNER JOIN follower ON user.user_id = follower.follower_user_id 
    WHERE 
      follower.following_user_id = ${user_id};`;
  const userFollowerArray = await database.all(userFollowersQuery);
  response.send(userFollowerArray);
});

// Get all tweets of api

// Get All Tweets of User API
app.get("/user/tweets", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.payload;

    const getTweetsQuery = `
      SELECT
        tweet_id AS tweetId,
        tweet,
        date_time AS dateTime
      FROM
        tweet
      WHERE
        user_id = ${user_id}
      ORDER BY
        dateTime DESC;
    `;
    const tweets = await database.all(getTweetsQuery);

    response.send(tweets);
  } catch (error) {
    console.error(error);
    response.status(500).send("Internal Server Error");
  }
});

// Get Tweet API - 6 COUNT
app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);
  const tweetQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetResult = await db.get(tweetQuery);
  const userFollowerQuery = `
         SELECT 
         * FROM follower INNER JOIN user ON user.user_id = follower.following_user_id 
         WHERE 
            follower.follower_user_id = ${user_id};`;

  const userFollowers = await db.all(userFollowerQuery);
  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
    console.log(tweetResult);
    console.log("-----------");
    console.log(userFollowers);
    const getTweetDetailsQuery = `
              SELECT 
                tweet,
                 COUNT(DISTINCT(like.like_id)) AS likes,
                 COUNT(DISTINCT(reply.reply_id)) AS replies,
                 tweet.data_time AS dateTime
              FROM
                  tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply.tweet_id
                  INNER JOIN reply ON reply.tweet_id = tweet.tweet_id 
              WHERE 
                 tweet.tweet_id = ${tweetId} AND tweet.user_id= ${userFollowers[0].user_id} 
                 ;`;

    const tweetDetails = await db.get(getTweetDetailsQuery);
    response.send(tweetDetails);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//

// Get Tweet Details API
app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const { user_id } = request.payload;

    const getTweetQuery = `
      SELECT 
        tweet_id AS tweetId,
        tweet,
        user_id
      FROM 
        tweet 
      WHERE 
        tweet_id = ${tweetId};
    `;
    const tweet = await database.get(getTweetQuery);

    if (!tweet) {
      response.status(404).send("Tweet not found");
      return;
    }

    const isFollowingQuery = `
      SELECT 
        1 
      FROM 
        follower 
      WHERE 
        follower_user_id = ${user_id} 
        AND following_user_id = ${tweet.user_id};
    `;
    const isFollowing = await database.get(isFollowingQuery);

    if (!isFollowing) {
      response.status(401).send("Invalid Request");
      return;
    }

    const getTweetDetailsQuery = `
      SELECT 
        tweet.tweet AS tweet,
        COUNT(DISTINCT like.like_id) AS likes,
        COUNT(DISTINCT reply.reply_id) AS replies,
        tweet.date_time AS dateTime
      FROM
        tweet
        INNER JOIN like ON tweet.tweet_id = like.tweet_id
        INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
      WHERE 
        tweet.tweet_id = ${tweetId}
        AND tweet.user_id = ${tweet.user_id};
    `;
    const tweetDetails = await database.get(getTweetDetailsQuery);

    response.send(tweetDetails);
  } catch (error) {
    console.error(error);
    response.status(500).send("Internal Server Error");
  }
});

// USER IS TWEET WHO LIKES TWEET AP 7

app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const getLikedUsersQuery = `
             SELECT 
               * 
              FROM 
                 follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER 
                 JOIN like ON like.tweet_id = tweet.tweet_id 
              WHERE 
               tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id} 
               ;`;
    const likedUsers = await db.all(getLikedUsersQuery);
    console.log(likedUsers);
    if (likedUsers.length !== 0) {
      let likes = [];
      const getNamesArray = (likedUsers) => {
        for (let item of likedUsers) {
          likes.push(item.username);
        }
      };
      getNamesArray(likedUsers);
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// user tweet replies API 8

app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const getRepliesUsersQuery = `
    SELECT
        * FROM 
            follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN
            reply follower.following_user_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
            
            
            WHERE 
            tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id}`;

    const repliesUsers = await db.all(getRepliesUsersQuery);
    console.log(repliesUsers);
    if (repliesUsers.length !== 0) {
      let replies = [];
      const getNamesArray = (repliedUsers) => {
        for (let item of repliesUsers) {
          let object = {
            name: item.name,
            reply: item.reply,
          };
          replies.push(object);
        }
      };
      getNamesArray(repliesUsers);
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//Get All Tweet of User API-9
app.get("/user/tweets", authenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, user_id);
  const getTweetsDetails = `
         SELECT
            tweet.tweet AS tweet,
            COUNT(DISTINCT(like.like_id) AS likes,
            COUNT(DISTINCT(reply.reply_id)) AS replies, 
            tweet.date_time AS dateTime 
        FROM 
           user INNER JOIN tweet  ON user.user_id = tweet.user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id
            INNER JOIN reply ON reply.tweet_id = tweet.tweet_id 
        WHERE 
           user.user_id = ${user_id} 
        GROUP BY 
           tweet.tweet_id;`;

  const tweetsDetails = await db.all(getTweetDetailsQuery);
  response.send(tweetsDetails);
});

//Get Post Tweet API-10
app.post("/user/tweets", authenticateToken, async (request, response) => {
  const { tweet } = request;
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);
  const postTweetQuery = `
      INSERT INTO 
         tweet (tweet, user_id) 
      VALUES(
          '${tweet}', 
           ${user_id}
           )
           ;`;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

//Delete Tweet API-11

app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const selectedQuery = `SELECT * FROM tweet WHERE tweet.user_id = ${user_id} AND tweet.tweet_id = ${tweetId};`;
  const tweetUser = await db.all(selectedQuery);
  if (tweetUser.length !== 0) {
    const deleteTweetQuery = `
           DELETE FROM tweet
           WHERE 
              tweet.user_id = ${user_id} AND tweet.tweet_id = ${tweetId};`;

    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
module.exports = app;
