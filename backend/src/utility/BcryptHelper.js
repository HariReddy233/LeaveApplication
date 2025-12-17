//External Lib Import
import bcrypt from "bcryptjs";

const HashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const VerifyPassword = async (password, hashPassword) => {
  return await bcrypt.compare(password, hashPassword);
};

export {
  HashPassword,
  VerifyPassword,
};









