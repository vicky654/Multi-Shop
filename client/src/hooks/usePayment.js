import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';

export function usePayment() {
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'card' | 'upi' | 'credit'
  const [receivedAmount, setReceivedAmount] = useState('');
  const [dueAmount, setDueAmount] = useState('');

  const handlePaymentMethodChange = useCallback((method) => {
    setPaymentMethod(method);
    setReceivedAmount('');
    setDueAmount('');
  }, []);

  const balanceAmount = useMemo(() => {
    const received = parseFloat(receivedAmount) || 0;
    return received;
  }, [receivedAmount]);

  const validatePayment = useCallback((grandTotal, customerId) => {
    // 1. Credit Validations
    if (paymentMethod === 'credit') {
      if (!customerId) {
        toast.error('A customer must be selected to record a credit sale.');
        return false;
      }
      const dueVal = parseFloat(dueAmount) || 0;
      if (dueVal <= 0) {
        toast.error('Please specify a credit amount greater than ₹0.');
        return false;
      }
      if (dueVal > grandTotal + 0.01) {
        toast.error(`Credit amount cannot exceed the grand total (₹${grandTotal.toFixed(0)}).`);
        return false;
      }
    }

    // 2. Cash validations
    if (paymentMethod === 'cash') {
      const received = parseFloat(receivedAmount) || 0;
      if (received > 0 && received < grandTotal - 0.01) {
        toast.error(`Received cash (₹${received.toFixed(0)}) is less than grand total (₹${grandTotal.toFixed(0)}). Select Credit payment to record balances.`);
        return false;
      }
    }

    return true;
  }, [paymentMethod, dueAmount, receivedAmount]);

  const resetPayment = useCallback(() => {
    setPaymentMethod('cash');
    setReceivedAmount('');
    setDueAmount('');
  }, []);

  return {
    paymentMethod,
    receivedAmount,
    dueAmount,
    setPaymentMethod: handlePaymentMethodChange,
    setReceivedAmount,
    setDueAmount,
    balanceAmount,
    validatePayment,
    resetPayment,
  };
}
