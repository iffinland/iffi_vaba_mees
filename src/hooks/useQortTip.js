import { useCallback, useState } from 'react';
import {
  getQortBalance,
  resolveNameAddress,
  sendQortTip,
} from '../services/videoEngagementService';

export const useQortTip = ({ notify }) => {
  const [video, setVideo] = useState(null);
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const openTip = useCallback(async (nextVideo) => {
    setVideo(nextVideo);
    setAmount('');
    setError('');
    setIsLoading(true);

    try {
      const [nextBalance, nextAddress] = await Promise.all([
        getQortBalance().catch(() => null),
        resolveNameAddress(nextVideo.authorName).catch(() => ''),
      ]);
      setBalance(typeof nextBalance === 'number' ? nextBalance : null);
      setRecipientAddress(nextAddress || '');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeTip = useCallback(() => {
    if (isSending) return;
    setVideo(null);
    setError('');
  }, [isSending]);

  const sendTip = useCallback(async () => {
    const parsedAmount = Number(amount);
    if (!video) return false;

    if (!recipientAddress) {
      setError('Recipient wallet address is unavailable.');
      return false;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a QORT amount greater than 0.');
      return false;
    }

    if (typeof balance === 'number' && parsedAmount > balance) {
      setError('Entered amount is higher than your wallet balance.');
      return false;
    }

    setIsSending(true);
    setError('');

    try {
      await sendQortTip({ recipient: recipientAddress, amount: parsedAmount });
      notify?.('Tip sent successfully.');
      setVideo(null);
      setAmount('');
      return true;
    } catch (err) {
      setError(err?.message || 'Tip transfer failed.');
      return false;
    } finally {
      setIsSending(false);
    }
  }, [amount, balance, notify, recipientAddress, video]);

  return {
    amount,
    balance,
    closeTip,
    error,
    isLoading,
    isOpen: Boolean(video),
    isSending,
    openTip,
    recipientAddress,
    setAmount,
    sendTip,
    video,
  };
};
