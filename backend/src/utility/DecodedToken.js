//External Lib Import
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

const DecodedToken = async (Token) => {
  return await jwt.verify(Token, JWT_SECRET);
};

export default DecodedToken;
















