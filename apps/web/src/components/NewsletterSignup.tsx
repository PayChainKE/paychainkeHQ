import React, { useState } from 'react';

// You can replace this with your actual logo or welcome image
const WELCOME_IMAGE_URL = '/public/icons/paychain-logo.png'; // Update path as needed

const NewsletterSignup: React.FC = () => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Add actual submission logic here
    setSubmitted(true);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 mt-10 border border-gray-200">
      <div className="flex flex-col items-center mb-6">
        <img
          src={WELCOME_IMAGE_URL}
          alt="Welcome to Paychain"
          className="w-24 h-24 mb-4 rounded-full object-cover"
        />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Don't be left out!</h2>
        <p className="text-gray-600 text-center">
          Subscribe to our newsletter and get access to the latest news, blogs, and tips directly to your inbox.
        </p>
      </div>
      {submitted ? (
        <div className="text-green-600 text-center font-semibold">
          Thank you for subscribing!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              First name
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              Last name
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition"
          >
            Subscribe
          </button>
        </form>
      )}
    </div>
  );
};

export default NewsletterSignup;
