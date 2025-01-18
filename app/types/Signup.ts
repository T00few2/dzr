// app/types/Signup.ts

export interface Signup {
    id: string;
    uid: string;
    displayName: string;
    zwiftID: string;
    currentRating?: number;
    max30Rating?: number;
    max90Rating?: number;
    group?: number; // 1..5
    phenotypeValue?: string; 
    updatedAt?: string;
    // Add any other fields you use in 'raceSignups'...
  }

  