terraform {
  required_version = ">= 1.0"

  backend "s3" {
    bucket         = "portfolio-terraform-state"
    key            = "terraform-landing-zone/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "portfolio-terraform-lock"
    encrypt        = true
  }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "portfolio-landing-zone-vpc"
    Environment = "portfolio"
  }
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name        = "portfolio-public-subnet-${count.index + 1}"
    Environment = "portfolio"
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "portfolio-private-subnet-${count.index + 1}"
    Environment = "portfolio"
    Tier        = "private"
  }
}

resource "aws_iam_role" "ec2_role" {
  name               = "portfolio-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      },
    ]
  })

  tags = {
    Name        = "portfolio-ec2-role"
    Environment = "portfolio"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "portfolio-igw"
    Environment = "portfolio"
  }
}

resource "aws_eip" "nat" {
  vpc = true
  tags = {
    Name        = "portfolio-nat-eip"
    Environment = "portfolio"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name        = "portfolio-nat-gw"
    Environment = "portfolio"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "portfolio-public-rt"
    Environment = "portfolio"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name        = "portfolio-private-rt"
    Environment = "portfolio"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
