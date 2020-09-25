import mongoose from 'mongoose';
import MongooseMonitor from 'af-mongoose-monitor';

const {
  MONGO_URL,
} = process.env;

/**
 *
 * @returns {*}
 */
const __connect = () => mongoose.connect(MONGO_URL, {
  useCreateIndex: true,
  promiseLibrary: global.Promise,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

/**
 * Monitora os eventos emitidos pelo driver do mongoose
 * @returns {mongoose}
 */
const boot = async () => {
  new MongooseMonitor(mongoose.connection).monitor();
  __connect();
  return mongoose;
};

const Mongo = { boot };
export default Mongo;
