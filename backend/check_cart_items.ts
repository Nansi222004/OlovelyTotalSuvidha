import mongoose from 'mongoose';
import Cart from './src/models/Cart';
import CartItem from './src/models/CartItem';
import dotenv from 'dotenv';

dotenv.config();

const checkCart = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB');

    const cartId = '6949265d047ae601c92a79ac'; // From your API response

    console.log('\n=== Checking Cart ===');
    const cart = await Cart.findById(cartId).populate('items');
    console.log('Cart:', JSON.stringify(cart, null, 2));

    console.log('\n=== Checking CartItems ===');
    const cartItems = await CartItem.find({ cart: cartId }).populate('product');
    console.log('CartItems count:', cartItems.length);
    console.log('CartItems:', JSON.stringify(cartItems, null, 2));

    console.log('\n=== All CartItems for this customer ===');
    const allCartItems = await CartItem.find({}).populate('product');
    const customerCartItems = allCartItems.filter((item: any) => {
      return item.cart && item.cart.toString() === cartId;
    });
    console.log('Total CartItems in DB:', allCartItems.length);
    console.log('Customer CartItems:', customerCartItems.length);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkCart();
