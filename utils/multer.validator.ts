import { extname } from 'path';

export class MulterValidators {
  /**
   * Accepted File TYPES
   * JPEG
   * PNG
   * GIF
   * PDF
   * MP3
   * MP4
   * MKV
   */
  static fileTypeFilter(req, file, callback) {
    //validate based on file types
    if (
      !file.originalname
        .toLowerCase()
        .match(/\.(jpe?g|png|gif|pdf|mp3|mp4|mkv|mov|ppt|csv|txt|rar|zip|doc|docx|pptx|xlsx|xls)$/)
    ) {
      const acceptedFileTypes = [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'pdf',
        'mp3',
        'mp4',
        'mov',
        'mkv',
        'ppt',
        'csv',
        'doc',
        'docx',
        'pptx',
        'xlsx',
        'xls',
        'rar',
        'zip',
        'txt'
      ];
      return callback(
        new Error(`Only files of ${acceptedFileTypes.join(', ')} are allowed!`),
        false,
      );
    }
    // if (file.size > 30000000000000000) {
    //   return callback(new Error('File size exceeds 100mb!'), false);
    // }

    if (file.size > 100000000000000000) {
      return callback(new Error('File size exceeds 1GB!'), false);
    }
    
    callback(null, true);
  }

  static excelFileFilter(req, file, callback) {
    if (!file.originalname.toLowerCase().match(/\.(xlsx|xls|csv)$/)) {
      return callback(new Error('Only Excel files are allowed!'), false);
    }

    callback(null, true);
  }

  static preserveOriginalFileName(req, file, callback) {
    const name = file.originalname.split('.')[0];
    const randomName = Array(4)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
    callback(null, `${name}${extname(file.originalname)}`);
  }

  static editFileName(req, file, callback) {
    //const name = file.originalname.split('.')[0];
    const randomName = Array(16)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
    callback(null, `${randomName}${extname(file.originalname)}`);
  }
}
