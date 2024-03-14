// components/Meta.tsx

import Head from 'next/head';

type MetaProps = {
  title: string;
  description: string;
  frontPageImage: string;
};

const Meta: React.FC<MetaProps> = ({ title, description, frontPageImage }) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={frontPageImage} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={frontPageImage} />
    </Head>
  );
};

export default Meta;
