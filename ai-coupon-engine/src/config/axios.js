import axios from "axios";
import { limiter } from "./limiter";

// have to use this to make api call to stay under limit
const limitedGet = limiter.wrap(axios.get)

export default limitedGet