let TMDB_API_KEY;
let Wyzie_API_KEY;

export const config = {
  init() {
    TMDB_API_KEY = process.env.TMDB_API_KEY;
    Wyzie_API_KEY = process.env.Wyzie_API_KEY;
  },

  getTMDBKey() { return TMDB_API_KEY; },
  getWyzieKey() { return Wyzie_API_KEY; },

  setTMDBKey(value) { TMDB_API_KEY = value; },
  setWyzieKey(value) { Wyzie_API_KEY = value; }
};
