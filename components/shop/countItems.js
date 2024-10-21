// app/utils/countItems.js
import { db } from '@/app/utils/firebaseConfig'; // Adjust the import path as necessary
import { collection, getDocs } from 'firebase/firestore';

export const countItems = async () => {
  let totalQuantity = 0;

  try {
    // Query all orders (no userId filter)
    const ordersRef = collection(db, 'orders');
    
    // Fetch all orders from Firestore
    const querySnapshot = await getDocs(ordersRef);
    
    const orders = querySnapshot.docs.map(doc => doc.data());

    // Count item quantities for item ids 1 and 2 across all orders
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.id === 1 || item.id === 2) {
          totalQuantity += item.quantity;
        }
      });
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    throw new Error('Failed to fetch orders.');
  }

  return totalQuantity;
};
