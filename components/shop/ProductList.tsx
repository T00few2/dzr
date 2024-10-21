import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Input,
  Stack,
  Image,
  SimpleGrid,
  Center,
  Select,
  Modal,       // Import Modal components
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Link,
  useDisclosure, // For opening and closing the modal
} from '@chakra-ui/react';

interface Product {
  id: number;
  name: string;
  description: React.ReactNode; // Change type to allow JSX in the description
  price: number;
  imageUrl: string;
  availableSizes: string[];
  availableFit: string[];
  weight: number;
}

interface ProductListProps {
  addToCart: (product: Product, quantity: number, selectedSize: string, selectedFit: string) => void;
}

const products: Product[] = [
  {
    id: 1,
    name: 'Bibs',
    description: (
      <>
        Nopinz Subzero DZR Bibs. Details on{' '}
        <Link href="https://nopinz.com/product/subzero-bib-shorts-mens-blue-aw23/" isExternal color="blue.300">
          nopinz.com
        </Link>
      </>
    ),
    price: 875,
    imageUrl: '/shop/bibs.jpg',
    availableSizes: ['2XS','XS','S', 'M', 'L', 'XL','2XL'],
    availableFit: ['Standard','Tall'],
    weight: 0.25,
  },
  {
    id: 2,
    name: 'Suit',
    description: (
      <>
        Nopinz Subzero DZR suit. Details on{' '}
        <Link href="https://nopinz.com/product/subzero-suit-mens-blue-aw23/" isExternal color="blue.300">
          nopinz.com
        </Link>
      </>
    ),
    price: 1275,
    imageUrl: '/shop/suit.jpg',
    availableSizes: ['2XS','XS','S', 'M', 'L', 'XL','2XL'],
    availableFit: ['Standard','Tall'],
    weight: 0.25,
  },
  {
    id: 3,
    name: 'Socks',
    description: (
      <>
        Nopinz DZR socks. Details on{' '}
        <Link href="    https://nopinz.com/product/pro-1-evo-socks-unisex-white/" isExternal color="blue.300">
          nopinz.com
        </Link>
      </>
    ),
    price: 175,
    imageUrl: '/shop/socks.jpeg',
    availableSizes: ['XS','S', 'M', 'L', 'XL'],
    availableFit: ['One fit'],
    weight: 0.05,
  },
  {
    id: 4,
    name: 'Cooling Packs',
    description: (
      <>
        Subzero gel packs and cool-bag for bibs and suit. Details on{' '}
        <Link href="https://live-nopinz-merge.pantheonsite.io/product/subzero-gel-packs-and-cool-bag/" isExternal color="blue.300">
          nopinz.com
        </Link>
      </>
    ),
    price: 300,
    imageUrl: '/shop/coolingpacks.jpeg',
    availableSizes: ['One size'],
    availableFit: ['One fit'],
    weight: 1.6,
  },
];

const ProductList: React.FC<ProductListProps> = ({ addToCart }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<{ [key: number]: number }>({});
  const [selectedSizes, setSelectedSizes] = useState<{ [key: number]: string }>({});
  const [selectedFit, setSelectedFit] = useState<{ [key: number]: string }>({});

    // Handle size preselection if only one size is available
  useEffect(() => {
    products.forEach((product) => {
      if (product.availableSizes.length === 1) {
        setSelectedSizes((prev) => ({ ...prev, [product.id]: product.availableSizes[0] }));
      }
      if (product.availableFit.length === 1) {
        setSelectedFit((prev) => ({ ...prev, [product.id]: product.availableFit[0] }));
      }
    });
  }, []);

  const handleQuantityChange = (productId: number, value: string) => {
    const quantity = parseInt(value) || 1;
    setQuantities((prev) => ({ ...prev, [productId]: quantity }));
  };

  const handleSizeChange = (productId: number, value: string) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: value }));
  };

  const handleFitChange = (productId: number, value: string) => {
    setSelectedFit((prev) => ({ ...prev, [productId]: value }));
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onOpen(); // Open the modal when an image is clicked
  };

  return (
    <Center>
      <Box width={'90%'}>
        
          <Text mt={4} mb={4} color={'white'}>Bestil dit nye IRL DZR kit her! Når vi har omkring 20 bestillinger &#40;suit og bibs i alt&#41;, kontakter vi dig for betaling 
            og sætter derefter tøjet i produktion. Det er mulig at ændre bestillingen her på websiden, indtil tøjet er betalt og sat i produktion. 
            Du kan vælge at afhente det på Frederiksberg eller få det leveret direkte til din adresse med DAO. Priserne er sat, så det hele forventes at løbe i nul. 
            Skulle der komme et lille plus på kontoen, vil det gå til fremtidige DZR initiativer. Eventuelt underskud vil blive dækket at styregruppen.<br/><br/>

            Tøjet er en replika af vores in-game DZR-kit og bliver produceret af Nopinz, der har udviklet bibs og suit &#40;et suit er grundlæggende bibs med &quot;indbygget&quot; svedtrøje&#41; 
            specifikt til indendørscykling. Materialet er ultralet og åndbart for at maksimere køleeffekten, og puden er optimeret til indendørs cykling 
            med bedre komfort og fugtstyring. Der er lommer til køleelementer &#40;købes separat&#41; på øvre og nedre ryg, der reducerer kropstemperaturen, 
            så du kan præstere bedre i længere tid! <br/><br/>Du kan læse reviews her:
            <Link href="https://zwiftinsider.com/nopinz-subzero-review/" isExternal color="blue.300"> ZwiftInsider</Link> og 
            <Link href="https://road.cc/content/review/nopinz-subzero-mens-shorts-281337" isExternal color="blue.300"> Road.cc</Link>
          </Text>    
        <SimpleGrid spacing={4} minChildWidth={'250px'} marginBlockEnd={4}>
  {products.map((product) => (
    <Box
      key={product.id}
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      p={4}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      <Image
        src={product.imageUrl}
        alt={product.name}
        width="100%"
        mb={2}
        objectFit="cover"
        aspectRatio={4 / 3}
        cursor="pointer" // Add pointer cursor to indicate clickable image
        onClick={() => handleImageClick(product.imageUrl)} // Open modal on click
      />

      <Box ml={2} flex="1">
        <Heading color='white' size="md">{product.name}</Heading>
        <Text color='white'>{product.description}</Text>
        </Box>
        <Box ml={2} mt="auto">
        <Text color='white' fontWeight="bold">{product.price} kr</Text>
     
        </Box>
        <Box mt="auto">
        <Select
          mt={2}
          mb={2}
          placeholder="Select size"
          color='white'
          value={selectedSizes[product.id] || ''}
          onChange={(e) => handleSizeChange(product.id, e.target.value)}
        >
          {product.availableSizes.map((size) => (
            <option key={size} value={size} style={{ backgroundColor: 'black', color: 'white' }}>
              {size}
            </option>
          ))}
        </Select>
        <Select
          mt={2}
          mb={2}
          placeholder="Select fit"
          color='white'
          value={selectedFit[product.id] || ''}
          onChange={(e) => handleFitChange(product.id, e.target.value)}
        >
          {product.availableFit.map((fit) => (
            <option key={fit} value={fit} style={{ backgroundColor: 'black', color: 'white' }}>
              {fit}
            </option>
          ))}
        </Select>

        <Flex>
          <Input
            mt={2}
            mb={2}
            placeholder="Quantity"
            type="number"
            value={quantities[product.id] || 1}
            min={1}
            width="80px"
            color={'white'}
            onChange={(e) => handleQuantityChange(product.id, e.target.value)}
          />
          <Button
            mt={2}
            ml={4}
            mb={2}
            onClick={() =>
              addToCart(product, quantities[product.id] || 1, selectedSizes[product.id] || '', selectedFit[product.id] || '')
            }
            colorScheme="red"
            isDisabled={!selectedSizes[product.id] || !selectedFit[product.id]}
          >
            Tilføj
          </Button>
        </Flex>
      </Box>
    </Box>
  ))}
</SimpleGrid>


        {/* Modal for enlarged image */}
        {selectedImage && (
          <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
            <ModalOverlay />
            <ModalContent>
              <ModalCloseButton />
              <ModalBody>
                <Image src={selectedImage} alt="Enlarged product" width="100%" />
              </ModalBody>
              <ModalFooter>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
      </Box>
    </Center>
  );
};

export default ProductList;
