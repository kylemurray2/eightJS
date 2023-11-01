import axios from 'axios';

//Constants_______________________________________________________________________________
const CLIENT_API_URL = 'https://client-api.8slp.net';
const APP_API_URL = 'https://app-api.8slp.net';
const AUTH_URL = 'https://auth-api.8slp.net/v1/tokens';

const TOKEN_TIME_BUFFER_SECONDS = 120000;  // in milliseconds
const DEFAULT_TIMEOUT = 2400; // Timeout can be used in axios calls if needed

const DEFAULT_API_HEADERS = {
  'content-type': 'application/json',
  'connection': 'keep-alive',
  'user-agent': 'Android App',
  'accept-encoding': 'gzip',
  'accept': 'application/json',
  'host': 'app-api.8slp.net',
  'authorization': 'Bearer ADD',  // Will be overridden
};

const DEFAULT_AUTH_HEADERS = {
  'content-type': 'application/json',
  'user-agent': 'Android App',
  'accept-encoding': 'gzip',
  'accept': 'application/json',
};
//_________________________________________________________________________


//Structs__________________________________________________________________
// Token data structure
class Token {
  constructor(bearer_token, expiration, main_id) {
    this.bearer_token = bearer_token;
    this.expiration = expiration; // This can be a timestamp in milliseconds
    this.main_id = main_id;
  }
}

// User data structure
class User {
  constructor(user_name, user_id, user_side) {
    this.user_name = user_name.toLowerCase();
    this.user_id = user_id;
    this.user_side = user_side;
  }

  match(match_str) {
    const lowerMatchStr = match_str.toLowerCase();
    if (lowerMatchStr === this.user_name || match_str === this.user_side) {
      return this.user_id;
    }
    return false;
  }
}
//______________________________________________________________________________

//eight_________________________________________________________________________
export default class EightSleep {
  constructor(email, password, client_id, client_secret) {
    this.email = email;
    this.password = password;
    this.client_id = client_id;
    this.client_secret = client_secret;
    this._api_session = null;
    this._token = null;
    this._users = [];

  }

  async getAuth() {
    const data = {
      client_id: this.client_id,
      client_secret: this.client_secret,
      grant_type: 'password',
      username: this.email,
      password: this.password,
    };

    try {
      const response = await axios.post(AUTH_URL, data, { headers: DEFAULT_AUTH_HEADERS });
      if (response.status === 200) {
        const { access_token, expires_in, userId } = response.data;
        this.token = {
          access_token,
          expiration: Date.now() + (expires_in * 1000) - TOKEN_TIME_BUFFER_SECONDS,
          main_id: userId,
        };   
        return this.token;
      } else {
        throw new Error(`Auth request failed with status code: ${response.status}`);
      }
    } catch (err) {
      if (err.response) {
          // The request was made and the server responded with a status code
          // outside of the range of 2xx
          console.error(err.response.data);
          console.error(err.response.status);
          console.error(err.response.headers);
      } else if (err.request) {
          // The request was made but no response was received
          console.error(err.request);
      } else {
          // Something happened in setting up the request and triggered an error
          console.error('Error', err.message);
      }
      console.error(err.config);
  }

  }

  async getToken() {
    if (!this.token || Date.now() > this.token.expiration) {
      await this.getAuth();
    }
    return this.token;
  }

  async apiRequest(method, url, data = null, headers = null) {
    try {
      const token = await this.getToken(); // Assume getToken is a method that retrieves the token
      const config = {
        method,
        url,
        timeout: DEFAULT_TIMEOUT,
        headers: headers || {...DEFAULT_API_HEADERS},
      };
  
      config.headers['Authorization'] = `Bearer ${token.access_token}`;
  
      if (data) {
        config.data = data;
      }
  
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Error ${method}ing data: `, error);
      throw error;
    }
  }

  // The remaining methods can go here, using `this.apiRequest` to make API calls.
  // For example:
  
  async setHeatingLevel(level, userId) {
    await this.turnOnSide(userId); // Assume this method turns on the side
    const url = `${APP_API_URL}/v1/users/${userId}/temperature`;
    const data = { currentLevel: level };
    await this.apiRequest('PUT', url, data);
  }

  async setHeatingAndDurationLevel(level, durationSeconds, userId) {
    // Set heating level from -100 to 100 for a period of time
    // userId can either be the name of the user or the side of the bed
    await this.turnOnSide(userId);  // Turn on side before setting temperature
    const url = `${APP_API_URL}/v1/users/${userId}/temperature`;
    const data = {
        timeBased: {
            level: level,
            durationSeconds: durationSeconds
        }
    };
    console.log(url)

    await this.apiRequest('PUT', url, data);
}

  matchUser(userId) {
    for (let user of this._users) {
        if (user.match(userId)) {
            return user.match(userId);
        }
    }
    throw new Error(`No users found for ${userId}. Make sure you run the start method prior.`);
    }

  async turnOnSide(user_id) {
    // Turns on the side of the user
    // user_id can either be the name of the user or the side of the bed
    const url = `${APP_API_URL}/v1/users/${user_id}/temperature`;     
    const data = { currentState: { type: "smart" } };
    await this.apiRequest("PUT", url, data);
  }
  
  async turnOffSide(user_id) {
    // Turns off the side of the user
    // userId can either be the name of the user or the side of the bed
    const url =  `${APP_API_URL}/v1/users/${user_id}/temperature`;   
    const data = { currentState: { type: 'off' } };
    await this.apiRequest("PUT", url, data);

}

async atExit() {
  try {
      // In the context of JavaScript's event-driven model, there's no direct
      // equivalent to getting a running loop. Instead, we can just attempt
      // to run the asynchronous function.
      await this.stop();
  } catch (error) {
      // If there's a runtime error or any other error, you might handle it here.
      // However, JavaScript doesn't have a direct counterpart to Python's RuntimeError
      // in this context, so we just attempt to run the stop() method again.
      await this.stop();
  }
}

  async getUsers() {
    const token = await this.getToken();
    const url = `${APP_API_URL}/v1/household/users/${token.main_id}/users`; // added leading slash
    const data = await this.apiRequest('GET', url);
    this.users = data.users.map(user => ({
      firstName: user.firstName,
      userId: user.userId,
      side:'left',
    }));
  }

  async start() {
    await this.getToken();
    await this.getUsers();
  }

  async stop() {
    if (this._api_session) {
        console.debug("Closing eight sleep api session.");
        await this._api_session.close();
        this._api_session = null;
        this.stop()
    }
}
}

module.exports = EightSleep;