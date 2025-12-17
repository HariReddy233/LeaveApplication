//External Lib Import
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7 days";

const CreateToken = async (payLoad) => {
  return await jwt.sign(payLoad, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export default CreateToken;









