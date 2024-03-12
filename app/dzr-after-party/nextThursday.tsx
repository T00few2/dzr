export function formatNextThursday() {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)
    
    // If today is Thursday, return today's date
    if (currentDayOfWeek === 4) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today).replace(',', ''); // Remove the comma
    }
  
    // Otherwise, calculate the date of the next Thursday
    const daysUntilNextThursday = (4 - currentDayOfWeek + 7) % 7;
    const nextThursday = new Date(today);
    nextThursday.setDate(today.getDate() + daysUntilNextThursday);
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(nextThursday).replace(',', ''); // Remove the comma
  }
  