import { DisjointSet } from "disjoint-set-ds/dist";
import sharp from "sharp";

export async function sharpToMatrix(sh: sharp.Sharp) {
  const { data: buf, info: { width, height } } = await sh
    .clone()
    .threshold()
    .extractChannel(0) // only one channel
    .raw()
    .toBuffer({ resolveWithObject: true });

  const binarised = buf.map(x => x / 255);

  // convert into 2d matrix
  return Array(height)
    .fill(null)
    .map((_, y) => Array(width)
      .fill(null)
      .map((_, x) => binarised[y * width + x]))
}

export function connectedComponents(matrix: number[][]) {
  const labels: number[][] = Array(matrix.length).fill(null).map(() => Array(matrix[0].length).fill(0));
  let currentLabel = 1;
  const labelEquivalence = new DisjointSet<number>();
  labelEquivalence.makeSet(0);
  // On the first pass:
  // Iterate through each element of the data by column, then by row (Raster Scanning)
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[0].length; x++) {
      // If the element is not the background
      if (matrix[y][x] === 0) {
        // Get the neighboring elements of the current element
        const west = x == 0 ? 1 : matrix[y][x - 1];
        const north = y == 0 ? 1 : matrix[y - 1][x];

        const westLabel = x == 0 ? 0 : labels[y][x - 1];
        const northLabel = y == 0 ? 0 : labels[y - 1][x];

        // if neighbors is empty then
        if (west === north && north === 1) {
          // linked[NextLabel] = set containing NextLabel
          labelEquivalence.makeSet(currentLabel)
          // labels[row][column] = NextLabel
          labels[y][x] = currentLabel;
          // NextLabel += 1
          currentLabel++;
          //         else
        } else {
          //             Find the smallest label
          // L = neighbors labels
          // labels[row][column] = min(L)
          let smallest: number;
          if (westLabel == 0) smallest = northLabel;
          else if (northLabel == 0) smallest = westLabel;
          else smallest = Math.min(northLabel, westLabel);
          labels[y][x] = smallest;
          // for label in L do
          //   linked[label] = union(linked[label], L)
          if (westLabel !== 0 && northLabel !== 0 && westLabel !== northLabel) labelEquivalence.union(westLabel, northLabel);
        }
      }
    }
  }


  // On the second pass:
  // Iterate through each element of the data by column, then by row
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[0].length; x++) {
      // If the element is not the background
      if (labels[y][x] !== 255)
        // Relabel the element with the lowest equivalent label
        labels[y][x] = labelEquivalence.find(labels[y][x]);
    }
  }

  const labelSet = [...new Set(labels.flat())].sort((a, b) => a - b);
  const sortedLabelMap = new Map(labelSet.map((label, i) => [label, i]))

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[0].length; x++) {
      // If the element is not the background
      if (labels[y][x] !== 255)
        // Relabel the element with the lowest equivalent label
        labels[y][x] = sortedLabelMap.get(labels[y][x])!;
    }
  }

  return labels;
}

export interface LabelData {
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,

  data: number[][]
}

export function analyzeLabels(labels: number[][]) {
  const dataMap = new Map<number, LabelData>();
  // iterate through labels and get bounds
  for (let y = 0; y < labels.length; y++) {
    for (let x = 0; x < labels[0].length; x++) {
      const label = labels[y][x];

      if (dataMap.has(label)) {
        const data = dataMap.get(label)!;
        if (x < data.xMin) data.xMin = x;
        if (x > data.xMax) data.xMax = x;
        if (y < data.yMin) data.yMin = y;
        if (y > data.yMax) data.yMax = y;

      } else {
        dataMap.set(label, {
          xMin: x,
          xMax: x,
          yMin: y,
          yMax: y,
          data: []
        })
      }

    }
  }

  for (const [label, data] of dataMap) {
    data.data = labels
      .slice(data.yMin, data.yMax + 1)
      .map(row => row
        .slice(data.xMin, data.xMax + 1)
        .map(x => +(x === label)))
  }

  // sort labels by x then y
  return [...dataMap.values()].sort((a, b) => {
    if (a.xMin - b.xMin === 0) return a.yMin - b.yMin
    return a.xMin - b.xMin
  })

}

export function labelResultsToImg(labels: number[][]) {
  const buf = Uint8Array.from(labels.flat().flatMap(v => {
    switch (v) {
      case 0: return [255, 255, 255]
      case 1: return [255, 0, 0]
      case 2: return [255, 128, 0]
      case 3: return [255, 255, 0]
      case 4: return [128, 255, 0]
      case 5: return [0, 255, 0]
      case 6: return [0, 255, 128]
      case 7: return [0, 255, 255]
      case 8: return [0, 128, 255]
      case 9: return [0, 0, 255]
      case 10: return [128, 0, 255]
      case 11: return [255, 0, 255]
      case 12: return [255, 0, 128]
      default: return [0, 0, 0]
    }
  }))

  return sharp(buf, {
    raw: {
      channels: 3,
      height: labels.length,
      width: labels[0].length,
    }
  })
}

export function processFromLabelData(dataList: LabelData[]) {
  const MARGIN = 5
  const filtered = dataList.slice(1).filter(({ yMax }) => yMax > 15)
  const maxHeight = Math.max(...filtered.map(x => x.yMax - x.yMin + 1))

  const marginColumns = Array<number[]>(maxHeight + MARGIN * 2).fill([]).map(_ => Array<number>(MARGIN).fill(0))

  const matrix = [...marginColumns]

  for (const { data, xMin, xMax, yMin, yMax } of filtered) {
    const width = xMax - xMin + 1
    const height = yMax - yMin + 1
    // TOP EDGE
    for (let i = 0; i < (maxHeight - height) + MARGIN; i++) {
      matrix[i]
        .push(...Array(width + MARGIN).fill(0))
    }
    // DATA
    for (let i = 0; i < height; i++) {
      matrix[i + ((maxHeight - height) + MARGIN)]
        .push(...data[i], ...Array<number>(MARGIN).fill(0))
    }
    // BOTTOM EDGE
    for (let i = 0; i < MARGIN; i++) {
      matrix[i + (maxHeight + MARGIN)]
        .push(...Array(width + MARGIN).fill(0))
    }
  }

  const buf = Uint8Array.from(matrix.flat().map(v => v === 1 ? 0 : 255))

  return sharp(buf, {
    raw: {
      channels: 1,
      height: matrix.length,
      width: matrix[0].length,
    }
  })
}